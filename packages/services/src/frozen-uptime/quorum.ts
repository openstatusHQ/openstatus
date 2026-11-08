import { uniqueRegions } from "@openstatus/utils";

import type { Counts } from "../status-timeline/tally";

// mirrors the cloud-region quorum in apps/workflows/src/checker/transition.ts;
// private-only monitors get none: private checks carry no shared run key
/** The number of regions a run is judged against, null without one. */
export function quorumRegionCount(regions: string): number | null {
  const cloud = uniqueRegions(regions);
  return cloud.length > 0 ? cloud.length : null;
}

export function quorumRegionCounts(
  monitors: { id: number; regions: string }[],
): Map<number, number> {
  const out = new Map<number, number>();
  for (const m of monitors) {
    const regionCount = quorumRegionCount(m.regions);
    if (regionCount !== null) out.set(m.id, regionCount);
  }
  return out;
}

/** The `regionCounts` param for a `type: "runs"` read, aligned with `monitorIds`. */
export function alignedRegionCounts(
  monitorIds: string[],
  regionCounts: Map<number, number>,
): number[] {
  return monitorIds.map((id) => regionCounts.get(Number(id)) ?? 0);
}

/** monitorId → YYYY-MM-DD → that day's run verdicts. */
export type RunsByDay = Map<string, Map<string, Counts>>;

export function runsByMonitorDay(
  rows: (Counts & { monitorId: string; day: string })[],
): RunsByDay {
  const out: RunsByDay = new Map();
  for (const { monitorId, day, ok, degraded, error } of rows) {
    if (ok + degraded + error <= 0) continue;
    const byDay = out.get(monitorId) ?? new Map<string, Counts>();
    const key = day.slice(0, 10);
    const acc = byDay.get(key) ?? { ok: 0, degraded: 0, error: 0 };
    acc.ok += ok;
    acc.degraded += degraded;
    acc.error += error;
    byDay.set(key, acc);
    out.set(monitorId, byDay);
  }
  return out;
}
