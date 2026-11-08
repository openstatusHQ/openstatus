import { uniqueRegions } from "@openstatus/utils";

import { type Counts, meetsQuorum } from "../status-timeline/tally";

type QuorumCountRow = {
  errorRegions: number;
  degradedOrErrorRegions: number;
  runs: number;
};

export type QuorumHistogramRow = QuorumCountRow & {
  monitorId: string;
  day: string; // ISO or YYYY-MM-DD; sliced to YYYY-MM-DD here
};

export type QuorumIntervalRow = QuorumCountRow & { interval: Date };

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

/**
 * One monitor's histogram rows → run verdicts per `keyOf` key, judged against
 * `regionCount`. Keys with no run get no entry.
 */
export function runsBy<Row extends QuorumCountRow>(
  rows: Row[],
  regionCount: number,
  keyOf: (row: Row) => string,
): Map<string, Counts> {
  const out = new Map<string, Counts>();
  if (regionCount <= 0) return out;
  for (const row of rows) {
    if (row.runs <= 0) continue;
    const key = keyOf(row);
    const runs = out.get(key) ?? { ok: 0, degraded: 0, error: 0 };
    if (meetsQuorum(row.errorRegions, regionCount)) runs.error += row.runs;
    else if (meetsQuorum(row.degradedOrErrorRegions, regionCount))
      runs.degraded += row.runs;
    else runs.ok += row.runs;
    out.set(key, runs);
  }
  return out;
}

/** Run verdicts per day, keyed YYYY-MM-DD. */
export function runsByDay(
  rows: QuorumHistogramRow[],
  regionCount: number,
): Map<string, Counts> {
  return runsBy(rows, regionCount, (row) => row.day.slice(0, 10));
}
