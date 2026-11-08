import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";

import type { Counts, DayCounts } from "../status-timeline/tally";
import { quorumRegionCount, type RunsByDay } from "./quorum";
import {
  fetchFreezeCounts,
  fetchRunsByDay,
  hasRuns,
  type UptimeFreezePipes,
  type UptimeRunsPipes,
} from "./run";

type LiveMonitor = { id: number; jobType: string; regions: string };

/**
 * Per-day run verdicts for the monitors with a quorum region count, in the
 * days the pipes group by. Never throws: a monitor whose read failed is left
 * out, so its days keep only `requests`.
 */
export async function fetchLiveRuns(args: {
  monitors: LiveMonitor[];
  pipes: UptimeRunsPipes;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<RunsByDay> {
  const { runs } = await fetchRunsByDay({ ...args, throttleMs: 0 });
  return runs;
}

/** Attach each day's run verdicts to the rows of the same day key. */
export function attachRuns<Row extends { monitorId: string; day: string }>(
  rowsByMonitorId: Map<string, Row[]>,
  runs: RunsByDay,
): Map<string, (Row & { runs?: Counts })[]> {
  const out = new Map<string, (Row & { runs?: Counts })[]>();
  for (const [monitorId, rows] of rowsByMonitorId) {
    const byDay = runs.get(monitorId);
    out.set(
      monitorId,
      rows.map((row) => {
        const dayRuns = byDay?.get(
          new Date(row.day).toISOString().slice(0, 10),
        );
        return dayRuns ? { ...row, runs: dayRuns } : row;
      }),
    );
  }
  return out;
}

type IntervalRow = {
  interval: Date;
  success: number;
  degraded: number;
  error: number;
};

/** An uptime interval pipe; `type: "runs"` returns run verdicts per bucket. */
export type IntervalPipeFn = (params: {
  monitorId: string;
  interval: number;
  fromDate?: string;
  toDate?: string;
  type: "runs";
  regionCount: number;
}) => Promise<{ data: IntervalRow[] }>;

/** interval start (ISO) → that bucket's run verdicts, for one monitor. */
export type IntervalRuns = Map<string, Counts>;

/**
 * Run verdicts per `interval`-minute bucket for one monitor. Null when the
 * monitor has no quorum region count; a failed read rejects.
 */
export async function fetchIntervalRuns(args: {
  monitor: LiveMonitor;
  pipe: IntervalPipeFn;
  interval: number;
  fromDate?: string;
  toDate?: string;
}): Promise<IntervalRuns | null> {
  const { monitor, pipe, ...window } = args;
  if (!hasRuns(monitor.jobType)) return null;
  const regionCount = quorumRegionCount(monitor.regions);
  if (regionCount === null) return null;
  const { data } = await pipe({
    monitorId: String(monitor.id),
    ...window,
    type: "runs",
    regionCount,
  });
  const out: IntervalRuns = new Map();
  for (const { interval, success, degraded, error } of data) {
    if (success + degraded + error > 0) {
      out.set(interval.toISOString(), { ok: success, degraded, error });
    }
  }
  return out;
}

export type IntervalCounts = DayCounts & { interval: Date };

/** Uptime interval rows as `requests`, with the run verdicts of the same interval. */
export function toIntervalCounts(
  rows: IntervalRow[],
  runs: IntervalRuns | null,
): IntervalCounts[] {
  return rows.map(({ interval, success, degraded, error }) => {
    const intervalRuns = runs?.get(interval.toISOString());
    return {
      interval,
      requests: { ok: success, degraded, error },
      ...(intervalRuns ? { runs: intervalRuns } : {}),
    };
  });
}

/**
 * Live per-day counts from the 45d pipes, keyed monitorId → day, with `runs`
 * under `withRuns` where the monitor has run verdicts. Never throws: a monitor
 * whose counts failed lands in `failedMonitorIds`; a failed runs read only
 * leaves its days without `runs`.
 */
export async function fetchLiveDays(args: {
  monitors: LiveMonitor[];
  pipes: UptimeFreezePipes;
  withRuns?: boolean;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{
  days: Map<string, Map<string, FrozenMonitorUptimeDay>>;
  failedMonitorIds: Set<string>;
}> {
  const monitorIdsByJobType = new Map<string, Set<string>>();
  for (const m of args.monitors) {
    const ids = monitorIdsByJobType.get(m.jobType) ?? new Set<string>();
    ids.add(String(m.id));
    monitorIdsByJobType.set(m.jobType, ids);
  }

  const [counts, runs] = await Promise.all([
    fetchFreezeCounts({
      monitorIdsByJobType,
      pipes: args.pipes,
      throttleMs: 0,
      sleep: args.sleep,
    }),
    args.withRuns
      ? fetchLiveRuns({
          monitors: args.monitors,
          pipes: args.pipes,
          sleep: args.sleep,
        })
      : Promise.resolve<RunsByDay>(new Map()),
  ]);

  const days = new Map<string, Map<string, FrozenMonitorUptimeDay>>();
  for (const row of counts.counts) {
    const byDay = days.get(row.monitorId) ?? new Map();
    const day = row.day.slice(0, 10);
    const acc = byDay.get(day) ?? {
      day,
      requests: { ok: 0, degraded: 0, error: 0 },
    };
    acc.requests.ok += row.ok;
    acc.requests.degraded += row.degraded;
    acc.requests.error += row.error;
    byDay.set(day, acc);
    days.set(row.monitorId, byDay);
  }

  for (const [monitorId, monitorRuns] of runs) {
    const byDay = days.get(monitorId);
    if (!byDay) continue;
    for (const [day, dayRuns] of monitorRuns) {
      const acc = byDay.get(day);
      if (acc) acc.runs = dayRuns;
    }
  }

  return {
    days,
    failedMonitorIds: counts.failedMonitorIds,
  };
}
