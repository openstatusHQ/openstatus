import type {
  FrozenMonitorUptimeDay,
  FrozenMonitorUptimeQuorum,
} from "@openstatus/db/src/schema";

import { quorumByDay, quorumPopulations } from "./quorum";
import {
  fetchFreezeCounts,
  fetchQuorumHistograms,
  groupByMonitorId,
  hasQuorumPipe,
  monitorIdsWithQuorum,
  type UptimeFreezePipes,
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

/** Attach each day's run quorum to the count rows of the same day key. */
export function attachQuorum<Row extends { monitorId: string; day: string }>(
  rowsByMonitorId: Map<string, Row[]>,
  quorum: LiveQuorum,
): Map<string, (Row & { quorum?: FrozenMonitorUptimeQuorum })[]> {
  const out = new Map<
    string,
    (Row & { quorum?: FrozenMonitorUptimeQuorum })[]
  >();
  for (const [monitorId, rows] of rowsByMonitorId) {
    const byDay = quorum.get(monitorId);
    out.set(
      monitorId,
      rows.map((row) => {
        const dayQuorum = byDay?.get(
          new Date(row.day).toISOString().slice(0, 10),
        );
        return dayQuorum ? { ...row, quorum: dayQuorum } : row;
      }),
    );
  }
  return out;
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
