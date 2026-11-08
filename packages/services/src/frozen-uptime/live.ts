import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";

import type { Counts, DayCounts } from "../status-timeline/tally";
import {
  runsBy,
  runsByDay,
  quorumRegionCount,
  quorumRegionCounts,
} from "./quorum";
import {
  fetchFreezeCounts,
  fetchQuorumHistograms,
  groupByMonitorId,
  hasQuorumPipe,
  monitorIdsWithQuorum,
  type UptimeFreezePipes,
  type UptimeQuorumIntervalPipes,
  type UptimeQuorumPipes,
} from "./run";

type LiveMonitor = { id: number; jobType: string; regions: string };

/** monitorId → YYYY-MM-DD → that day's run verdicts. */
export type LiveRuns = Map<string, Map<string, Counts>>;

/**
 * Per-day run verdicts for the monitors with a quorum region count, grouped
 * into the days of `timeZone`. Never throws: a monitor whose histogram failed
 * is left out, so its days keep only `requests`.
 */
export async function fetchLiveRuns(args: {
  monitors: LiveMonitor[];
  quorumPipes: UptimeQuorumPipes;
  timeZone?: string;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<LiveRuns> {
  const regionCounts = quorumRegionCounts(
    args.monitors.filter((m) => hasQuorumPipe(args.quorumPipes, m.jobType)),
  );
  const { histograms, failedMonitorIds } = await fetchQuorumHistograms({
    monitorIdsByJobType: monitorIdsWithQuorum(args.monitors, regionCounts),
    pipes: args.quorumPipes,
    timeZone: args.timeZone,
    attempts: args.attempts,
    throttleMs: 0,
    sleep: args.sleep,
  });

  const byMonitorId = groupByMonitorId(histograms);
  const out: LiveRuns = new Map();
  for (const [monitorId, regionCount] of regionCounts) {
    const id = String(monitorId);
    if (failedMonitorIds.has(id)) continue;
    out.set(id, runsByDay(byMonitorId.get(id) ?? [], regionCount));
  }
  return out;
}

/** Attach each day's run verdicts to the rows of the same day key. */
export function attachRuns<Row extends { monitorId: string; day: string }>(
  rowsByMonitorId: Map<string, Row[]>,
  runs: LiveRuns,
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

/** interval start (ISO) → that bucket's run verdicts, for one monitor. */
export type IntervalRuns = Map<string, Counts>;

/**
 * Run verdicts per `interval`-minute bucket for one monitor, bucketed like the
 * uptime interval endpoints. Null when the monitor has no quorum region count;
 * a failed read rejects.
 */
export async function fetchIntervalRuns(args: {
  monitor: LiveMonitor;
  pipes: UptimeQuorumIntervalPipes;
  interval: number;
  fromDate?: string;
  toDate?: string;
}): Promise<IntervalRuns | null> {
  const { monitor, pipes, ...window } = args;
  if (!hasQuorumPipe(pipes, monitor.jobType)) return null;
  const regionCount = quorumRegionCount(monitor.regions);
  if (regionCount === null) return null;
  const { data } = await pipes[monitor.jobType]({
    monitorId: String(monitor.id),
    ...window,
  });
  return runsBy(data, regionCount, (row) => row.interval.toISOString());
}

export type IntervalCounts = DayCounts & { interval: Date };

/** Uptime interval rows as `requests`, with the run verdicts of the same interval. */
export function toIntervalCounts(
  rows: { interval: Date; success: number; degraded: number; error: number }[],
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
 * where the job type has run verdicts (none without `quorumPipes`). Never
 * throws: a monitor whose counts failed lands in `failedMonitorIds`; a failed
 * histogram only leaves its days without `runs`.
 */
export async function fetchLiveDays(args: {
  monitors: LiveMonitor[];
  pipes: UptimeFreezePipes;
  quorumPipes?: UptimeQuorumPipes;
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
    args.quorumPipes
      ? fetchLiveRuns({
          monitors: args.monitors,
          quorumPipes: args.quorumPipes,
          sleep: args.sleep,
        })
      : Promise.resolve<LiveRuns>(new Map()),
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
