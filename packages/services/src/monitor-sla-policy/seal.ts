import {
  and,
  db as defaultDb,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
} from "@openstatus/db";
import {
  frozenMonitorUptime,
  frozenMonitorUptimeDaySchema,
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  type MonitorSlaSealedWindow,
  monitorSlaSealedMonth,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";

import { type DB, defaultTb } from "../context";
import { monthRange } from "../frozen-uptime/compute";
import { type Counts, NO_RUNS } from "../frozen-uptime/quorum";
import {
  FREEZE_CUTOFF_MS,
  type UptimeRunsRangePipes,
  uptimeRunsRangePipes,
} from "../frozen-uptime/run";
import { withBusyRetry } from "../retry";
import { evaluateSlaMonth, sumMonthRuns } from "./evaluate";
import { fetchExcusedCounts, mergeSpans } from "./excused";
import { completeMonths, monthCellKey } from "./months";

/** A closed month stays open to policy corrections this long before it seals. */
export const SEAL_DELAY_MS = 72 * 3_600_000;

const INSERT_CHUNK = 50;

export type SealMonitorSlaMonthsResult = {
  month: string;
  sealed: number;
  /** why nothing was attempted; null when the month was eligible */
  skipped: "correction-window" | "past-cutoff" | null;
  /** pairs left for the next run because their run counts could not be read */
  unavailable: number;
  /** policies of those pairs */
  unavailablePolicyIds: number[];
};

type SealWindow = {
  month: string;
  start: number;
  end: number;
  skipped: SealMonitorSlaMonthsResult["skipped"];
};

function sealWindow(now: number): SealWindow {
  const [month] = completeMonths(new Date(now), 1);
  const { start, end } = monthRange(month);
  const skipped =
    now - start >= FREEZE_CUTOFF_MS
      ? "past-cutoff"
      : now - end < SEAL_DELAY_MS
        ? "correction-window"
        : null;
  return { month, start, end, skipped };
}

type Pair = {
  workspaceId: number;
  policyId: number;
  target: number;
  strict: boolean;
  monitorId: number;
  jobType: string;
  regions: string;
  days: unknown;
};

/**
 * Seals each policy's previous month, once frozen, for pairs that existed before it ended.
 * Write-once per (policy, monitor, month), so overlapping runs seal each pair once.
 * No audit row: a system job on a write-once table, like the freeze.
 */
export async function sealMonitorSlaMonths(
  args: {
    db?: DB;
    now?: Date;
    // scope a run (tests, manual retries); default all policies
    policyIds?: number[];
    runsRangePipes?: UptimeRunsRangePipes;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<SealMonitorSlaMonthsResult> {
  const db = args.db ?? defaultDb;
  const now = (args.now ?? new Date()).getTime();
  const window = sealWindow(now);
  const { month } = window;
  const idle = {
    month,
    sealed: 0,
    skipped: window.skipped,
    unavailable: 0,
    unavailablePolicyIds: [],
  };
  if (args.policyIds?.length === 0 || window.skipped !== null) return idle;
  const monthEnd = new Date(window.end);

  const pairs: Pair[] = await withBusyRetry(() =>
    db
      .select({
        workspaceId: monitorSlaPolicy.workspaceId,
        policyId: monitorSlaPolicy.id,
        target: monitorSlaPolicy.target,
        strict: monitorSlaPolicy.strict,
        monitorId: monitor.id,
        jobType: monitor.jobType,
        regions: monitor.regions,
        days: frozenMonitorUptime.days,
      })
      .from(monitorSlaPolicyToMonitor)
      .innerJoin(
        monitorSlaPolicy,
        eq(monitorSlaPolicy.id, monitorSlaPolicyToMonitor.monitorSlaPolicyId),
      )
      .innerJoin(
        monitor,
        and(
          eq(monitor.id, monitorSlaPolicyToMonitor.monitorId),
          eq(monitor.workspaceId, monitorSlaPolicy.workspaceId),
        ),
      )
      .leftJoin(
        frozenMonitorUptime,
        and(
          eq(frozenMonitorUptime.monitorId, monitor.id),
          eq(frozenMonitorUptime.month, month),
        ),
      )
      .leftJoin(
        monitorSlaSealedMonth,
        and(
          eq(monitorSlaSealedMonth.monitorSlaPolicyId, monitorSlaPolicy.id),
          eq(monitorSlaSealedMonth.monitorId, monitor.id),
          eq(monitorSlaSealedMonth.month, month),
        ),
      )
      .where(
        and(
          args.policyIds
            ? inArray(monitorSlaPolicy.id, args.policyIds)
            : undefined,
          isNotNull(frozenMonitorUptime.monitorId),
          lt(monitorSlaPolicy.createdAt, monthEnd),
          isNull(monitorSlaPolicy.archivedAt),
          lt(monitorSlaPolicyToMonitor.createdAt, monthEnd),
          isNull(monitor.deletedAt),
          isNull(monitorSlaSealedMonth.id),
        ),
      )
      .all(),
  );
  if (pairs.length === 0) return idle;

  const workspaceRows = await withBusyRetry(() =>
    db
      .select()
      .from(workspace)
      .where(
        inArray(
          workspace.id,
          Array.from(new Set(pairs.map((p) => p.workspaceId))),
        ),
      )
      .all(),
  );
  const allowed = new Set<number>();
  for (const row of workspaceRows) {
    const parsed = selectWorkspaceSchema.safeParse(row);
    if (parsed.success && parsed.data.limits["monitor-sla"]) {
      allowed.add(parsed.data.id);
    }
  }
  const sealable = pairs.filter((p) => allowed.has(p.workspaceId));

  const countsFor = (p: Pair): Counts | undefined => {
    const days = frozenMonitorUptimeDaySchema.array().safeParse(p.days);
    if (!days.success) {
      console.warn(
        `monitor-sla seal: unreadable frozen month ${month} for monitor ${p.monitorId}`,
      );
      return undefined;
    }
    return sumMonthRuns(days.data);
  };

  const { excusedFor, windowIdsOf } = await sealExcused({
    db,
    window,
    now,
    pairs: sealable,
    pipes: () => args.runsRangePipes ?? uptimeRunsRangePipes(defaultTb),
    sleep: args.sleep,
  });

  const unavailable: number[] = [];
  const values = new Map<
    number,
    (typeof monitorSlaSealedMonth.$inferInsert)[]
  >();
  for (const p of sealable) {
    const counts = countsFor(p);
    const excused = excusedFor(p);
    if (excused === "unavailable") {
      unavailable.push(p.policyId);
      continue;
    }
    if (!counts || counts.ok + counts.degraded + counts.error === 0) continue;
    // every run excused: sealed without a judgement, keeping its windows
    const result = evaluateSlaMonth({
      counts,
      excused: excused.counts,
      target: p.target,
      strict: p.strict,
    });
    const own = values.get(p.policyId) ?? [];
    own.push({
      workspaceId: p.workspaceId,
      monitorSlaPolicyId: p.policyId,
      monitorId: p.monitorId,
      month,
      target: p.target,
      strict: p.strict,
      ...counts,
      excusedOk: excused.counts.ok,
      excusedDegraded: excused.counts.degraded,
      excusedError: excused.counts.error,
      excusedWindows: excused.windows,
      total: result.total,
      up: result.up,
      uptime: result.uptime,
      met: result.met,
    });
    values.set(p.policyId, own);
  }

  let sealed = 0;
  for (const [policyId, rows] of values) {
    // Window adds and removes check for seal rows in their own write
    // transaction, so re-reading the windows here serializes with them.
    const inserted = await withBusyRetry(() =>
      db.transaction(async (tx) => {
        const current = await tx
          .select({ id: monitorSlaExcusedWindow.id })
          .from(monitorSlaExcusedWindow)
          .where(
            and(
              eq(monitorSlaExcusedWindow.monitorSlaPolicyId, policyId),
              lt(monitorSlaExcusedWindow.from, monthEnd),
              gt(monitorSlaExcusedWindow.to, new Date(window.start)),
            ),
          )
          .all();
        const counted = windowIdsOf(policyId);
        if (
          current.length !== counted.size ||
          current.some((w) => !counted.has(w.id))
        ) {
          return null;
        }
        let n = 0;
        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
          const res = await tx
            .insert(monitorSlaSealedMonth)
            .values(rows.slice(i, i + INSERT_CHUNK))
            .onConflictDoNothing({
              target: [
                monitorSlaSealedMonth.monitorSlaPolicyId,
                monitorSlaSealedMonth.monitorId,
                monitorSlaSealedMonth.month,
              ],
            })
            .returning({ id: monitorSlaSealedMonth.id });
          n += res.length;
        }
        return n;
      }),
    );
    if (inserted === null) {
      // its windows changed while their runs were counted
      unavailable.push(...rows.map(() => policyId));
      continue;
    }
    sealed += inserted;
  }
  if (unavailable.length > 0) {
    console.warn(
      `monitor-sla seal: run counts unavailable for ${unavailable.length} pairs in ${month}; retried next run`,
    );
  }
  return {
    month,
    sealed,
    skipped: null,
    unavailable: unavailable.length,
    unavailablePolicyIds: [...new Set(unavailable)],
  };
}

/**
 * Per pair, the runs inside its policy's excused windows over the sealed
 * month and the windows themselves; "unavailable" when they could not be read.
 */
async function sealExcused(args: {
  db: DB;
  window: SealWindow;
  now: number;
  pairs: Pair[];
  pipes: () => UptimeRunsRangePipes;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{
  excusedFor: (
    p: Pair,
  ) => { counts: Counts; windows: MonitorSlaSealedWindow[] } | "unavailable";
  /** the windows counted for a policy, to check none changed before its rows are written */
  windowIdsOf: (policyId: number) => Set<number>;
}> {
  const { db, window } = args;
  const none = { counts: NO_RUNS, windows: [] };
  const noWindows = {
    excusedFor: () => none,
    windowIdsOf: () => new Set<number>(),
  };
  const policyIds = [...new Set(args.pairs.map((p) => p.policyId))];
  if (policyIds.length === 0) return noWindows;
  const rows = await withBusyRetry(() =>
    db
      .select()
      .from(monitorSlaExcusedWindow)
      .where(
        and(
          inArray(monitorSlaExcusedWindow.monitorSlaPolicyId, policyIds),
          lt(monitorSlaExcusedWindow.from, new Date(window.end)),
          gt(monitorSlaExcusedWindow.to, new Date(window.start)),
        ),
      )
      .all(),
  );
  if (rows.length === 0) return noWindows;

  const byPolicy = new Map<
    number,
    {
      windows: MonitorSlaSealedWindow[];
      counts: Map<string, Counts>;
      unreadable: Set<string>;
    }
  >();
  for (const policyId of new Set(rows.map((r) => r.monitorSlaPolicyId))) {
    const own = rows
      .filter((r) => r.monitorSlaPolicyId === policyId)
      .sort((a, b) => a.from.getTime() - b.from.getTime() || a.id - b.id);
    const monitors = [
      ...new Map(
        args.pairs
          .filter((p) => p.policyId === policyId)
          .map((p) => [
            p.monitorId,
            { id: p.monitorId, jobType: p.jobType, regions: p.regions },
          ]),
      ).values(),
    ];
    const res = await fetchExcusedCounts({
      monitors,
      spans: mergeSpans(own),
      months: [window.month],
      now: new Date(args.now),
      pipes: args.pipes,
      sleep: args.sleep,
    });
    byPolicy.set(policyId, {
      windows: own.map((r) => ({
        id: r.id,
        kind: r.kind,
        reason: r.reason,
        from: r.from.getTime(),
        to: r.to.getTime(),
      })),
      counts: res.counts,
      unreadable: new Set([...res.failed, ...res.expired]),
    });
  }
  return {
    excusedFor: (p) => {
      const entry = byPolicy.get(p.policyId);
      if (!entry) return none;
      const key = monthCellKey(p.monitorId, window.month);
      if (entry.unreadable.has(key)) return "unavailable";
      return {
        counts: entry.counts.get(key) ?? NO_RUNS,
        windows: entry.windows,
      };
    },
    windowIdsOf: (policyId) =>
      new Set(byPolicy.get(policyId)?.windows.map((w) => w.id)),
  };
}
