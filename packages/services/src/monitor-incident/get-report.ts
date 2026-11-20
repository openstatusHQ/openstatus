import {
  and,
  db as defaultDb,
  desc,
  eq,
  gt,
  isNull,
  lt,
  min,
  or,
} from "@openstatus/db";
import {
  monitorHeartbeatState,
  monitorIncidentTable,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import type { DB, ServiceContext } from "../context";
import { ValidationError } from "../errors";
import { splitByMonth } from "../frozen-uptime/months";
import { getMonitorInWorkspace } from "../monitor/internal";
import { clampInterval, floorPct, mergedDowntimeMs } from "../status-timeline";
import {
  enrichIncidentsBatch,
  type MonitorIncidentWithRelations,
} from "./list";
import { GetMonitorReportInput } from "./schemas";

export type MonitorReportMonth = {
  /** YYYY-MM-01, UTC */
  month: string;
  availability: number;
  downtimeMs: number;
  outages: number;
};

export type MonitorReport = {
  /** [from, to): the period clipped to when the monitor was first measured and now */
  window: { from: Date; to: Date };
  /** thousandths of a percent; null when the window is empty */
  availability: number | null;
  downtimeMs: number;
  excusedMs: number;
  outageCount: number;
  longestMs: number | null;
  mttrMs: number | null;
  /** empty when the plan has no uptime history */
  months: MonitorReportMonth[];
  /** every outage overlapping the window, excused ones included, newest first */
  incidents: MonitorIncidentWithRelations[];
};

function ratio(spanMs: number, downMs: number): number {
  return floorPct((spanMs - downMs) / spanMs);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Same rule as `heartbeatCoverageStart` on the status page: the UTC day of the
 * first ping, or the first outage if that is earlier.
 */
async function heartbeatMeasuredFrom(
  db: DB,
  monitorId: number,
  firstPingAt: Date,
): Promise<number> {
  const firstDay = Math.floor(firstPingAt.getTime() / DAY_MS) * DAY_MS;
  const first = await db
    .select({ startedAt: min(monitorIncidentTable.startedAt) })
    .from(monitorIncidentTable)
    .where(eq(monitorIncidentTable.monitorId, monitorId))
    .get();
  return Math.min(firstDay, first?.startedAt?.getTime() ?? firstDay);
}

/** Outage-based availability of one monitor over a period; excused outages count as up. */
export async function getMonitorReport(args: {
  ctx: ServiceContext;
  input: GetMonitorReportInput;
  now?: Date;
}): Promise<MonitorReport> {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorReportInput.parse(args.input);
  if (input.from >= input.to) {
    throw new ValidationError("The period must end after it starts.");
  }
  const db = ctx.db ?? defaultDb;
  const nowMs = (args.now ?? new Date()).getTime();

  const record = await getMonitorInWorkspace({
    tx: db,
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });

  const heartbeat =
    record.jobType === "heartbeat"
      ? await db
          .select({
            lastPingAt: monitorHeartbeatState.lastPingAt,
            firstPingAt: monitorHeartbeatState.firstPingAt,
          })
          .from(monitorHeartbeatState)
          .where(eq(monitorHeartbeatState.monitorId, record.id))
          .get()
      : undefined;
  const measuredFrom =
    (heartbeat?.firstPingAt
      ? await heartbeatMeasuredFrom(db, record.id, heartbeat.firstPingAt)
      : null) ??
    record.createdAt?.getTime() ??
    input.from.getTime();
  const start = Math.max(input.from.getTime(), measuredFrom);
  // a heartbeat that never pinged was never measured: no data, not 100%
  const neverPinged = record.jobType === "heartbeat" && !heartbeat?.lastPingAt;
  const end = neverPinged ? start : Math.min(input.to.getTime(), nowMs);
  const window = { start, end: Math.max(start, end), now: nowMs };

  const rows =
    window.end > window.start
      ? await db
          .select()
          .from(monitorIncidentTable)
          .where(
            and(
              eq(monitorIncidentTable.workspaceId, ctx.workspace.id),
              eq(monitorIncidentTable.monitorId, record.id),
              lt(monitorIncidentTable.startedAt, new Date(window.end)),
              or(
                isNull(monitorIncidentTable.resolvedAt),
                gt(monitorIncidentTable.resolvedAt, new Date(window.start)),
              ),
            ),
          )
          .orderBy(desc(monitorIncidentTable.startedAt))
          .all()
      : [];

  const counted = rows.filter((r) => r.excusedAt == null);
  const intervalsOf = (list: typeof rows, w = window) =>
    list.flatMap((r) => {
      const iv = clampInterval(r.startedAt, r.resolvedAt, 1, w);
      return iv ? [iv] : [];
    });
  const downIntervals = intervalsOf(counted);
  const downtimeMs = mergedDowntimeMs(downIntervals);
  // excused time already covered by a counted outage is downtime, not excused
  const excusedMs = mergedDowntimeMs(intervalsOf(rows)) - downtimeMs;

  const spanMs = window.end - window.start;
  const durations = downIntervals.map((iv) => iv.to - iv.from);
  const resolveTimes = counted.flatMap((r) =>
    r.resolvedAt ? [r.resolvedAt.getTime() - r.startedAt.getTime()] : [],
  );

  const parts = ctx.workspace.limits["uptime-history"]
    ? splitByMonth(window.start, window.end)
    : [];
  const months = parts.map((part) => {
    const w = { start: part.start, end: part.end, now: nowMs };
    const monthIntervals = intervalsOf(counted, w);
    const down = mergedDowntimeMs(monthIntervals);
    return {
      month: part.month,
      availability: ratio(part.end - part.start, down),
      downtimeMs: down,
      outages: monthIntervals.length,
    };
  });

  return {
    window: { from: new Date(window.start), to: new Date(window.end) },
    availability: spanMs > 0 ? ratio(spanMs, downtimeMs) : null,
    downtimeMs,
    excusedMs,
    outageCount: counted.length,
    longestMs: durations.length > 0 ? Math.max(...durations) : null,
    mttrMs:
      resolveTimes.length > 0
        ? Math.round(
            resolveTimes.reduce((sum, ms) => sum + ms, 0) / resolveTimes.length,
          )
        : null,
    months,
    incidents: await enrichIncidentsBatch(db, rows, ctx.workspace.id),
  };
}
