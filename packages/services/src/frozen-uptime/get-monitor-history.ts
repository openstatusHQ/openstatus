import { and, asc, eq, isNull } from "@openstatus/db";
import {
  frozenMonitorUptime,
  frozenMonitorUptimeDaySchema,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { defaultTb, getReadDb, type ServiceContext } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import { monthRange } from "./compute";
import { fetchLiveDays } from "./live";
import {
  countsRuns,
  FREEZE_CUTOFF_MS,
  type UptimeFreezePipes,
  type UptimeRunsPipes,
  uptimeFreezePipes,
  uptimeRunsPipes,
} from "./run";
import { GetMonitorUptimeHistoryInput } from "./schemas";

type DayCount = { day: string; ok: number; degraded: number; error: number };

type MonitorUptimeHistoryResult = {
  /** UTC days oldest → newest; frozen months are zero-filled, live ones sparse */
  days: DayCount[];
  /** the same days counted per run, only the days with run verdicts; null when the monitor has none */
  runs: DayCount[] | null;
  /** live counts failed to load, so the current month may be missing */
  partial: boolean;
  /** live run verdicts failed to load, or the live counts they attach to */
  runsPartial: boolean;
};

/**
 * Daily request and run counts for one monitor: every frozen month, plus live
 * Tinybird counts for the months the freeze hasn't covered yet.
 */
export async function getMonitorUptimeHistory(args: {
  ctx: ServiceContext;
  input: GetMonitorUptimeHistoryInput;
  pipes?: UptimeFreezePipes;
  runsPipes?: UptimeRunsPipes;
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
}): Promise<MonitorUptimeHistoryResult> {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorUptimeHistoryInput.parse(args.input);
  if (!ctx.workspace.limits["uptime-history"]) {
    throw new ForbiddenError("Uptime history is not enabled on this plan.");
  }
  const db = getReadDb(ctx);
  const nowMs = (args.now ?? new Date()).getTime();

  const _monitor = await db.query.monitor.findFirst({
    where: (monitor, { and: andWhere, eq: eqWhere }) =>
      andWhere(
        eqWhere(monitor.id, input.monitorId),
        eqWhere(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ),
  });
  if (!_monitor) throw new NotFoundError("monitor", input.monitorId);

  const tb = ctx.tb ?? defaultTb;
  const withRuns = countsRuns(_monitor);
  const [frozenRows, live] = await Promise.all([
    db
      .select({
        month: frozenMonitorUptime.month,
        days: frozenMonitorUptime.days,
      })
      .from(frozenMonitorUptime)
      .where(
        and(
          eq(frozenMonitorUptime.workspaceId, ctx.workspace.id),
          eq(frozenMonitorUptime.monitorId, _monitor.id),
        ),
      )
      .orderBy(asc(frozenMonitorUptime.month)),
    fetchLiveDays({
      monitors: [_monitor],
      pipes: args.pipes ?? uptimeFreezePipes(tb),
      runsPipes: withRuns ? (args.runsPipes ?? uptimeRunsPipes(tb)) : undefined,
      sleep: args.sleep,
    }),
  ]);

  const byDay = new Map<string, DayCount>();
  const runsByDay = new Map<string, DayCount>();
  const frozenMonths = new Set<string>();
  for (const row of frozenRows) {
    frozenMonths.add(row.month.slice(0, 7));
    for (const d of frozenMonitorUptimeDaySchema.array().parse(row.days)) {
      byDay.set(d.day, { day: d.day, ...d.requests });
      if (d.runs) runsByDay.set(d.day, { day: d.day, ...d.runs });
    }
  }

  // only unfrozen months still inside the pipes' 45d lookback: an older
  // month would come back with its first days missing
  for (const d of live.days.get(String(_monitor.id))?.values() ?? []) {
    const month = d.day.slice(0, 7);
    if (frozenMonths.has(month)) continue;
    if (nowMs - monthRange(`${month}-01`).start >= FREEZE_CUTOFF_MS) continue;
    byDay.set(d.day, { day: d.day, ...d.requests });
    if (d.runs) runsByDay.set(d.day, { day: d.day, ...d.runs });
  }

  const sorted = (days: Map<string, DayCount>) =>
    [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1));

  const partial = live.failedMonitorIds.size > 0;
  return {
    days: sorted(byDay),
    // frozen runs outlive a move to private-only locations
    runs: withRuns || runsByDay.size > 0 ? sorted(runsByDay) : null,
    partial,
    runsPartial: partial || live.failedRunsMonitorIds.size > 0,
  };
}
