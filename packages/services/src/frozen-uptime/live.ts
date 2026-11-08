import type {
  FrozenMonitorUptimeDay,
  FrozenMonitorUptimeQuorum,
} from "@openstatus/db/src/schema";

import {
  quorumBy,
  quorumByDay,
  quorumPopulation,
  quorumPopulations,
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

/** monitorId → YYYY-MM-DD → that day's run quorum. */
export type LiveQuorum = Map<string, Map<string, FrozenMonitorUptimeQuorum>>;

/**
 * Per-day run quorum for the monitors with a quorum population, grouped into
 * the days of `timeZone`. Never throws: a monitor whose histogram failed is
 * left out, so its days stay on per-region counts.
 */
export async function fetchLiveQuorum(args: {
  monitors: LiveMonitor[];
  quorumPipes: UptimeQuorumPipes;
  timeZone?: string;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<LiveQuorum> {
  const populations = quorumPopulations(
    args.monitors.filter((m) => hasQuorumPipe(args.quorumPipes, m.jobType)),
  );
  const { histograms, failedMonitorIds } = await fetchQuorumHistograms({
    monitorIdsByJobType: monitorIdsWithQuorum(args.monitors, populations),
    pipes: args.quorumPipes,
    timeZone: args.timeZone,
    attempts: args.attempts,
    throttleMs: 0,
    sleep: args.sleep,
  });

  const byMonitorId = groupByMonitorId(histograms);
  const out: LiveQuorum = new Map();
  for (const [monitorId, population] of populations) {
    const id = String(monitorId);
    if (failedMonitorIds.has(id)) continue;
    out.set(id, quorumByDay(byMonitorId.get(id) ?? [], population));
  }
  return out;
}

type WithQuorum<Row> = Row & { quorum?: FrozenMonitorUptimeQuorum };

function attachBy<Row extends object>(
  rows: Row[],
  byKey: Map<string, FrozenMonitorUptimeQuorum> | undefined,
  keyOf: (row: Row) => string,
): WithQuorum<Row>[] {
  return rows.map((row) => {
    const quorum = byKey?.get(keyOf(row));
    return quorum ? { ...row, quorum } : row;
  });
}

/** Attach each day's run quorum to the count rows of the same day key. */
export function attachQuorum<Row extends { monitorId: string; day: string }>(
  rowsByMonitorId: Map<string, Row[]>,
  quorum: LiveQuorum,
): Map<string, WithQuorum<Row>[]> {
  const out = new Map<string, WithQuorum<Row>[]>();
  for (const [monitorId, rows] of rowsByMonitorId) {
    out.set(
      monitorId,
      attachBy(rows, quorum.get(monitorId), (row) =>
        new Date(row.day).toISOString().slice(0, 10),
      ),
    );
  }
  return out;
}

/** interval start (ISO) → that bucket's run quorum, for one monitor. */
export type IntervalQuorum = Map<string, FrozenMonitorUptimeQuorum>;

/**
 * Run quorum per `interval`-minute bucket for one monitor, bucketed like the
 * uptime interval endpoints. Null when the monitor has no quorum population;
 * a failed read rejects.
 */
export async function fetchIntervalQuorum(args: {
  monitor: LiveMonitor;
  pipes: UptimeQuorumIntervalPipes;
  interval: number;
  fromDate?: string;
  toDate?: string;
}): Promise<IntervalQuorum | null> {
  const { monitor, pipes, ...window } = args;
  if (!hasQuorumPipe(pipes, monitor.jobType)) return null;
  const population = quorumPopulation(monitor.regions);
  if (!population) return null;
  const { data } = await pipes[monitor.jobType]({
    monitorId: String(monitor.id),
    ...window,
  });
  return quorumBy(data, population, (row) => row.interval.toISOString());
}

/** Attach each bucket's run quorum to the uptime row of the same interval. */
export function attachIntervalQuorum<Row extends { interval: Date }>(
  rows: Row[],
  quorum: IntervalQuorum,
): WithQuorum<Row>[] {
  return attachBy(rows, quorum, (row) => row.interval.toISOString());
}

/**
 * Live per-day counts from the 45d pipes, keyed monitorId → day, with the run
 * histogram attached where the job type has one. Never throws: a monitor whose
 * counts failed lands in `failedMonitorIds`; a failed histogram only leaves
 * its days on per-region counts.
 */
export async function fetchLiveDays(args: {
  monitors: LiveMonitor[];
  pipes: UptimeFreezePipes;
  quorumPipes: UptimeQuorumPipes;
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

  const [counts, quorum] = await Promise.all([
    fetchFreezeCounts({
      monitorIdsByJobType,
      pipes: args.pipes,
      throttleMs: 0,
      sleep: args.sleep,
    }),
    fetchLiveQuorum({
      monitors: args.monitors,
      quorumPipes: args.quorumPipes,
      sleep: args.sleep,
    }),
  ]);

  const days = new Map<string, Map<string, FrozenMonitorUptimeDay>>();
  for (const row of counts.counts) {
    const byDay = days.get(row.monitorId) ?? new Map();
    const day = row.day.slice(0, 10);
    const acc = byDay.get(day) ?? { day, ok: 0, degraded: 0, error: 0 };
    acc.ok += row.ok;
    acc.degraded += row.degraded;
    acc.error += row.error;
    byDay.set(day, acc);
    days.set(row.monitorId, byDay);
  }

  for (const [monitorId, quorumDays] of quorum) {
    const byDay = days.get(monitorId);
    if (!byDay) continue;
    for (const [day, dayQuorum] of quorumDays) {
      const acc = byDay.get(day);
      if (acc) acc.quorum = dayQuorum;
    }
  }

  return {
    days,
    failedMonitorIds: counts.failedMonitorIds,
  };
}
