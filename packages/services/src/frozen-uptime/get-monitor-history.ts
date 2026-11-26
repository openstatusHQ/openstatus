import { and, asc, eq, gte } from "@openstatus/db";
import {
  frozenMonitorUptime,
  frozenMonitorUptimeDaySchema,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { defaultTb, getReadDb, type ServiceContext } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import { monthRange } from "./compute";
import { fetchLiveDays, mergeLocalDays } from "./live";
import { historyStart } from "./months";
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
  const historyMonths = ctx.workspace.limits["uptime-history"];
  if (!historyMonths) {
    throw new ForbiddenError("Uptime history is not enabled on this plan.");
  }
  const db = getReadDb(ctx);
  const nowMs = (args.now ?? new Date()).getTime();
  const firstMonth = historyStart(nowMs, historyMonths);

  const _monitor = await db.query.monitor.findFirst({
    where: {
      id: input.monitorId,
      workspaceId: ctx.workspace.id,
      deletedAt: { isNull: true },
    },
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
          gte(frozenMonitorUptime.month, firstMonth),
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

  const frozen = frozenRows.map((row) => ({
    month: row.month,
    days: frozenMonitorUptimeDaySchema.array().parse(row.days),
  }));
  const frozenMonths = new Set(frozen.map((row) => row.month.slice(0, 7)));
  const local = mergeLocalDays({
    frozen,
    live: live.days.get(String(_monitor.id))?.values() ?? [],
    timeZone: "UTC",
  });
  // an unfrozen month older than the pipes' 45d lookback would come back
  // with its first days missing
  const covered = (d: DayCount) => {
    const month = d.day.slice(0, 7);
    return (
      d.day >= firstMonth &&
      (frozenMonths.has(month) ||
        nowMs - monthRange(`${month}-01`).start < FREEZE_CUTOFF_MS)
    );
  };
  const runs = local.runs.filter(covered);

  const partial = live.failedMonitorIds.size > 0;
  return {
    days: local.requests.filter(covered),
    // frozen runs outlive a move to private-only locations
    runs: withRuns || runs.length > 0 ? runs : null,
    partial,
    runsPartial: partial || live.failedRunsMonitorIds.size > 0,
  };
}
