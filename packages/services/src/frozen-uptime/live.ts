import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { loadQuorumPopulations, quorumByDay } from "./quorum";
import {
  fetchFreezeCounts,
  fetchQuorumHistograms,
  groupByMonitorId,
  hasQuorumPipe,
  monitorIdsWithQuorum,
  type UptimeFreezePipes,
  type UptimeQuorumPipes,
} from "./run";

/**
 * Live per-day counts from the 45d pipes, keyed monitorId → day, with the run
 * histogram attached where the job type has one. Never throws: a monitor whose
 * counts failed lands in `failedMonitorIds`; a failed histogram only leaves
 * its days on per-region counts.
 */
export async function fetchLiveDays(args: {
  db: DB;
  monitors: { id: number; jobType: string; regions: string }[];
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

  const populations = await loadQuorumPopulations({
    db: args.db,
    monitors: args.monitors.filter((m) =>
      hasQuorumPipe(args.quorumPipes, m.jobType),
    ),
  });

  const [counts, quorum] = await Promise.all([
    fetchFreezeCounts({
      monitorIdsByJobType,
      pipes: args.pipes,
      throttleMs: 0,
      sleep: args.sleep,
    }),
    fetchQuorumHistograms({
      monitorIdsByJobType: monitorIdsWithQuorum(args.monitors, populations),
      pipes: args.quorumPipes,
      throttleMs: 0,
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

  const histograms = groupByMonitorId(quorum.histograms);
  for (const [monitorId, population] of populations) {
    const byDay = days.get(String(monitorId));
    if (!byDay) continue;
    const rows = histograms.get(String(monitorId)) ?? [];
    for (const [day, dayQuorum] of quorumByDay(rows, population)) {
      const acc = byDay.get(day);
      if (acc) acc.quorum = dayQuorum;
    }
  }

  return {
    days,
    failedMonitorIds: counts.failedMonitorIds,
  };
}
