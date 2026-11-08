import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";

import {
  fetchFreezeCounts,
  fetchRunsByDay,
  type UptimeFreezePipes,
  type UptimeRunsPipes,
} from "./run";

/**
 * Live per-day counts from the 45d pipes, keyed monitorId → day, with `runs`
 * where the monitor has run verdicts. Never throws: a monitor whose counts
 * failed lands in `failedMonitorIds`; a failed runs read only leaves its days
 * without `runs`.
 */
export async function fetchLiveDays(args: {
  monitors: { id: number; jobType: string; regions: string }[];
  pipes: UptimeFreezePipes;
  runsPipes: UptimeRunsPipes;
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
    fetchRunsByDay({
      monitors: args.monitors,
      pipes: args.runsPipes,
      throttleMs: 0,
      sleep: args.sleep,
    }),
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

  for (const [monitorId, monitorRuns] of runs.runs) {
    const byDay = days.get(monitorId);
    if (!byDay) continue;
    for (const [day, dayRuns] of monitorRuns) {
      const acc = byDay.get(day);
      if (acc) acc.runs = dayRuns;
    }
  }

  return { days, failedMonitorIds: counts.failedMonitorIds };
}
