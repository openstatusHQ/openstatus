import { and, asc, eq, gte, inArray, isNull, lte } from "@openstatus/db";
import {
  frozenMonitorUptime,
  frozenMonitorUptimeDaySchema,
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";
import {
  monitorSlaIneligibleReason,
  monitorSlaJobTypes,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";

import { type DB, defaultTb, getReadDb, type ServiceContext } from "../context";
import {
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "../errors";
import {
  addCounts,
  type Counts,
  type RunsByDay,
} from "../frozen-uptime/quorum";
import {
  fetchRunsByDay,
  type UptimeRunsPipes,
  type UptimeRunsRangePipes,
  uptimeRunsPipes,
  uptimeRunsRangePipes,
} from "../frozen-uptime/run";
import { sumMonthRuns } from "./evaluate";
import { excusedWindowLock, fetchExcusedCounts, mergeSpans } from "./excused";
import {
  type CellExcused,
  completeMonths,
  countedMonth,
  liveUntilFrozen,
  type MonitorSlaMonth,
  monthCellKey,
  monthOf,
  storedMonth,
} from "./months";

// fails tsc when the run-verdict pipes and the eligible types drift apart
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _sameJobTypes: Exact<
  (typeof monitorSlaJobTypes)[number],
  keyof UptimeRunsPipes
> = true;

export function assertMonitorSlaLimit(ctx: ServiceContext): void {
  if (!ctx.workspace.limits["monitor-sla"]) {
    throw new ForbiddenError("SLA policies are not enabled on this plan.");
  }
}

/** Dedupe, check workspace ownership and eligibility; returns ids in input order. */
export async function validatePolicyMonitorIds(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: ReadonlyArray<number>;
}): Promise<number[]> {
  const ids = Array.from(new Set(args.monitorIds));
  if (ids.length === 0) return [];
  const rows = await args.tx
    .select({
      id: monitor.id,
      name: monitor.name,
      jobType: monitor.jobType,
      regions: monitor.regions,
    })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, ids),
        eq(monitor.workspaceId, args.workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) throw new NotFoundError("monitor", id);
    const reason = monitorSlaIneligibleReason(row);
    if (reason) {
      throw new ValidationError(
        `Monitor "${row.name}" cannot be under an SLA policy: ${reason}.`,
      );
    }
  }
  return ids;
}

/** The policy in the caller's workspace, archived or not. */
export async function findPolicy(db: DB, ctx: ServiceContext, id: number) {
  const row = await db
    .select()
    .from(monitorSlaPolicy)
    .where(
      and(
        eq(monitorSlaPolicy.id, id),
        eq(monitorSlaPolicy.workspaceId, ctx.workspace.id),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("monitor_sla_policy", id);
  return row;
}

/** The policy for a write; an archived policy is read-only. */
export async function getWritablePolicy(
  tx: DB,
  ctx: ServiceContext,
  id: number,
) {
  const row = await findPolicy(tx, ctx, id);
  if (row.archivedAt) {
    throw new PreconditionFailedError(
      "This SLA policy is archived and can no longer be edited.",
    );
  }
  return row;
}

/** Every month the policy sealed for any monitor. */
export async function sealedMonthsOf(
  tx: DB,
  policy: { id: number; workspaceId: number },
) {
  return tx
    .selectDistinct({ month: monitorSlaSealedMonth.month })
    .from(monitorSlaSealedMonth)
    .where(
      and(
        eq(monitorSlaSealedMonth.monitorSlaPolicyId, policy.id),
        eq(monitorSlaSealedMonth.workspaceId, policy.workspaceId),
      ),
    )
    .all();
}

export async function assertExcusedWindowOpen(
  tx: DB,
  policy: { id: number; workspaceId: number },
  window: { from: Date; to: Date },
  now: Date,
): Promise<void> {
  const lock = excusedWindowLock(window, {
    now,
    sealed: await sealedMonthsOf(tx, policy),
  });
  if (lock === "sealed") {
    throw new PreconditionFailedError(
      "This window touches a sealed month. A sealed month keeps the windows it was sealed with.",
    );
  }
  if (lock === "closed") {
    throw new PreconditionFailedError(
      "Windows can only be added or removed in the current and the previous month.",
    );
  }
}

/** Live run verdicts summed per monitor and month; never throws. */
async function fetchLiveMonths(args: {
  monitors: { id: number; jobType: string; regions: string }[];
  pipes: () => UptimeRunsPipes;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ counts: Map<string, Counts>; failed: Set<number> }> {
  let runs: RunsByDay;
  let failedIds: Set<string>;
  try {
    ({ runs, failedMonitorIds: failedIds } = await fetchRunsByDay({
      monitors: args.monitors,
      pipes: args.pipes(),
      throttleMs: 0,
      sleep: args.sleep,
    }));
  } catch (e) {
    console.warn("monitor sla live runs unavailable", e);
    return {
      counts: new Map(),
      failed: new Set(args.monitors.map((m) => m.id)),
    };
  }
  const counts = new Map<string, Counts>();
  for (const [monitorId, byDay] of runs) {
    for (const [day, c] of byDay) {
      addCounts(counts, monthCellKey(monitorId, `${day.slice(0, 7)}-01`), c);
    }
  }
  return { counts, failed: new Set([...failedIds].map(Number)) };
}

/** The policy and its current members (non-deleted monitors), by monitor id. */
export async function loadPolicyMembers(ctx: ServiceContext, id: number) {
  const db = getReadDb(ctx);
  const policy = await findPolicy(db, ctx, id);
  const monitors = await db
    .select({
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      jobType: monitor.jobType,
      regions: monitor.regions,
    })
    .from(monitorSlaPolicyToMonitor)
    .innerJoin(monitor, eq(monitor.id, monitorSlaPolicyToMonitor.monitorId))
    .where(
      and(
        eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ),
    )
    .orderBy(asc(monitor.id))
    .all();
  return { policy, monitors };
}

/**
 * Each member's state per month (YYYY-MM-01, ascending).
 * Without `live`, live months carry no counts.
 */
export async function judgePolicyMonths(args: {
  ctx: ServiceContext;
  policy: { id: number; target: number; strict: boolean };
  monitors: Awaited<ReturnType<typeof loadPolicyMembers>>["monitors"];
  months: string[];
  now: Date;
  live: boolean;
  runsPipes?: UptimeRunsPipes;
  runsRangePipes?: UptimeRunsRangePipes;
  sleep?: (ms: number) => Promise<void>;
}) {
  const { ctx, policy, monitors, months, now } = args;
  const db = getReadDb(ctx);
  const liveMonths = new Set([monthOf(now)]);
  const [previousMonth] = completeMonths(now, 1);
  if (liveUntilFrozen(previousMonth, now)) liveMonths.add(previousMonth);
  const first = months[0];
  const last = months.at(-1);
  if (monitors.length === 0 || !first || !last) {
    return { monitors: [], liveIncomplete: false, excusedExpired: false };
  }

  const frozenRows = await db
    .select({
      monitorId: frozenMonitorUptime.monitorId,
      month: frozenMonitorUptime.month,
      days: frozenMonitorUptime.days,
    })
    .from(frozenMonitorUptime)
    .where(
      and(
        eq(frozenMonitorUptime.workspaceId, ctx.workspace.id),
        inArray(
          frozenMonitorUptime.monitorId,
          monitors.map((m) => m.id),
        ),
        gte(frozenMonitorUptime.month, first),
        lte(frozenMonitorUptime.month, last),
      ),
    )
    .all();
  const live =
    args.live && months.some((m) => liveMonths.has(m))
      ? await fetchLiveMonths({
          monitors,
          pipes: () => args.runsPipes ?? uptimeRunsPipes(ctx.tb ?? defaultTb),
          sleep: args.sleep,
        })
      : { counts: new Map<string, Counts>(), failed: new Set<number>() };
  const sealedRows = await db
    .select()
    .from(monitorSlaSealedMonth)
    .where(
      and(
        eq(monitorSlaSealedMonth.monitorSlaPolicyId, policy.id),
        eq(monitorSlaSealedMonth.workspaceId, ctx.workspace.id),
        gte(monitorSlaSealedMonth.month, first),
        lte(monitorSlaSealedMonth.month, last),
      ),
    )
    .all();
  const sealed = new Map(
    sealedRows.map((r) => [monthCellKey(r.monitorId, r.month), r]),
  );
  const frozen = new Map(
    frozenRows.map((r) => [
      monthCellKey(r.monitorId, r.month),
      sumMonthRuns(frozenMonitorUptimeDaySchema.array().parse(r.days)),
    ]),
  );
  // a live cell without `live` is dropped, so its excused runs are not read
  const shown = (m: { id: number }, month: string) => {
    const key = monthCellKey(m.id, month);
    return (
      !sealed.has(key) &&
      (args.live || !liveMonths.has(month) || frozen.has(key))
    );
  };

  const excused = await fetchExcusedCounts({
    monitors,
    spans: mergeSpans(
      await db
        .select({
          from: monitorSlaExcusedWindow.from,
          to: monitorSlaExcusedWindow.to,
        })
        .from(monitorSlaExcusedWindow)
        .where(
          and(
            eq(monitorSlaExcusedWindow.monitorSlaPolicyId, policy.id),
            eq(monitorSlaExcusedWindow.workspaceId, ctx.workspace.id),
          ),
        )
        .all(),
    ),
    months: months.filter((month) => monitors.some((m) => shown(m, month))),
    now,
    pipes: () =>
      args.runsRangePipes ?? uptimeRunsRangePipes(ctx.tb ?? defaultTb),
    sleep: args.sleep,
  });
  const excusedFor = (key: string): CellExcused =>
    excused.failed.has(key)
      ? "unavailable"
      : excused.expired.has(key)
        ? "expired"
        : excused.counts.get(key);

  const rows = monitors.map(({ regions: _regions, ...m }) => ({
    ...m,
    months: months.map((month): MonitorSlaMonth => {
      const key = monthCellKey(m.id, month);
      const seal = sealed.get(key);
      const counts = frozen.get(key);
      if (seal) return storedMonth({ month, seal, frozen: counts, policy });
      if (!counts && liveMonths.has(month)) {
        return countedMonth({
          month,
          state: "live",
          counts: live.failed.has(m.id) ? undefined : live.counts.get(key),
          excused: excusedFor(key),
          policy,
        });
      }
      return storedMonth({
        month,
        seal,
        frozen: counts,
        excused: excusedFor(key),
        policy,
      });
    }),
  }));
  return {
    monitors: rows,
    liveIncomplete: live.failed.size > 0 || excused.failed.size > 0,
    /** some month's excused runs are older than Tinybird keeps: those cells are judged without their windows */
    excusedExpired: excused.expired.size > 0,
  };
}
