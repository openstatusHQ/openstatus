import type { FrozenMonitorUptimeQuorum } from "@openstatus/db/src/schema";
import { uniqueRegions } from "@openstatus/utils";

type QuorumCountRow = {
  private: boolean;
  errorRegions: number;
  notOkRegions: number;
  runs: number;
};

export type QuorumHistogramRow = QuorumCountRow & {
  monitorId: string;
  day: string; // ISO or YYYY-MM-DD; sliced to YYYY-MM-DD here
};

export type QuorumIntervalRow = QuorumCountRow & { interval: Date };

/** The regions a run is judged against: the same set incidents open on. */
export type QuorumPopulation = { private: boolean; regionCount: number };

// mirrors the cloud-region quorum in apps/workflows/src/checker/transition.ts;
// private-only monitors get none: private checks carry no shared run key
export function quorumPopulation(regions: string): QuorumPopulation | null {
  const cloud = uniqueRegions(regions);
  return cloud.length > 0
    ? { private: false, regionCount: cloud.length }
    : null;
}

export function quorumPopulations(
  monitors: { id: number; regions: string }[],
): Map<number, QuorumPopulation> {
  const out = new Map<number, QuorumPopulation>();
  for (const m of monitors) {
    const population = quorumPopulation(m.regions);
    if (population) out.set(m.id, population);
  }
  return out;
}

/**
 * One monitor's histogram rows → quorum per `keyOf` bucket for its population.
 * Buckets with no run in scope get no entry, so they fall back to per-region counts.
 */
export function quorumBy<Row extends QuorumCountRow>(
  rows: Row[],
  population: QuorumPopulation,
  keyOf: (row: Row) => string,
): Map<string, FrozenMonitorUptimeQuorum> {
  const out = new Map<string, FrozenMonitorUptimeQuorum>();
  if (population.regionCount <= 0) return out;
  for (const row of rows) {
    if (row.private !== population.private || row.runs <= 0) continue;
    const key = keyOf(row);
    const quorum = out.get(key) ?? {
      regionCount: population.regionCount,
      buckets: [],
    };
    const bucket = quorum.buckets.find(
      (b) =>
        b.errorRegions === row.errorRegions &&
        b.notOkRegions === row.notOkRegions,
    );
    if (bucket) bucket.runs += row.runs;
    else
      quorum.buckets.push({
        errorRegions: row.errorRegions,
        notOkRegions: row.notOkRegions,
        runs: row.runs,
      });
    out.set(key, quorum);
  }
  return out;
}

/** Per-day quorum, keyed YYYY-MM-DD. */
export function quorumByDay(
  rows: QuorumHistogramRow[],
  population: QuorumPopulation,
): Map<string, FrozenMonitorUptimeQuorum> {
  return quorumBy(rows, population, (row) => row.day.slice(0, 10));
}
