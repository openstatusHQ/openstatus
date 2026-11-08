import { and, asc, eq, isNull } from "@openstatus/db";
import {
  frozenMonitorUptime,
  type FrozenMonitorUptimeDay,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { defaultTb, getReadDb, type ServiceContext } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import { monthRange } from "./compute";
import { fetchLiveDays } from "./live";
import {
  FREEZE_CUTOFF_MS,
  type UptimeFreezePipes,
  uptimeFreezePipes,
  type UptimeQuorumPipes,
  uptimeQuorumPipes,
  uptimeRegionCount,
} from "./run";
import { GetMonitorUptimeHistoryInput } from "./schemas";

type MonitorUptimeHistoryResult = {
  /** UTC days oldest → newest; frozen months are zero-filled, live ones sparse */
  days: FrozenMonitorUptimeDay[];
  /** live counts failed to load, so the current month may be missing */
  partial: boolean;
  /** pass to `tallyDay`: runs when set, region checks when null */
  regionCount: number | null;
};

/**
 * Daily check counts for one monitor: every frozen month, plus live Tinybird
 * counts for the months the freeze hasn't covered yet.
 */
export async function getMonitorUptimeHistory(args: {
  ctx: ServiceContext;
  input: GetMonitorUptimeHistoryInput;
  pipes?: UptimeFreezePipes;
  quorumPipes?: UptimeQuorumPipes;
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
      pipes: args.pipes ?? uptimeFreezePipes(ctx.tb ?? defaultTb),
      quorumPipes: args.quorumPipes ?? uptimeQuorumPipes(ctx.tb ?? defaultTb),
      sleep: args.sleep,
    }),
  ]);

  const byDay = new Map<string, FrozenMonitorUptimeDay>();
  const frozenMonths = new Set<string>();
  for (const row of frozenRows) {
    frozenMonths.add(row.month.slice(0, 7));
    for (const d of row.days) byDay.set(d.day, d);
  }

  // only unfrozen months still inside the pipes' 45d lookback: an older
  // month would come back with its first days missing
  for (const d of live.days.get(String(_monitor.id))?.values() ?? []) {
    const month = d.day.slice(0, 7);
    if (frozenMonths.has(month)) continue;
    if (nowMs - monthRange(`${month}-01`).start >= FREEZE_CUTOFF_MS) continue;
    byDay.set(d.day, d);
  }

  return {
    days: [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
    partial: live.failedMonitorIds.size > 0,
    regionCount: uptimeRegionCount(_monitor),
  };
}
