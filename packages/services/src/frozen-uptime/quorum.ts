import { and, count, inArray, isNull } from "@openstatus/db";
import {
  type FrozenMonitorUptimeQuorum,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

export type QuorumHistogramRow = {
  monitorId: string;
  day: string; // ISO or YYYY-MM-DD; sliced to YYYY-MM-DD here
  private: boolean;
  errorRegions: number;
  notOkRegions: number;
  runs: number;
};

/** The regions a run is judged against: the same set incidents open on. */
export type QuorumPopulation = { private: boolean; regionCount: number };

// mirrors apps/workflows/src/checker: monitors with cloud regions decide on
// them alone (transition.ts); private locations decide only for private-only
// monitors (private-location.ts)
export function quorumPopulation(args: {
  regions: string;
  privateLocationCount: number;
}): QuorumPopulation {
  const cloud = args.regions.split(",").filter((r) => r.trim().length > 0);
  return cloud.length > 0
    ? { private: false, regionCount: cloud.length }
    : { private: true, regionCount: args.privateLocationCount };
}

const IN_CHUNK = 500;

export async function loadQuorumPopulations(args: {
  db: DB;
  monitors: { id: number; regions: string }[];
}): Promise<Map<number, QuorumPopulation>> {
  const privateOnlyIds = args.monitors
    .filter((m) => quorumPopulation({ ...m, privateLocationCount: 0 }).private)
    .map((m) => m.id);

  const locations = new Map<number, number>();
  for (let i = 0; i < privateOnlyIds.length; i += IN_CHUNK) {
    const rows = await args.db
      .select({
        monitorId: privateLocationToMonitors.monitorId,
        count: count(),
      })
      .from(privateLocationToMonitors)
      .where(
        and(
          inArray(
            privateLocationToMonitors.monitorId,
            privateOnlyIds.slice(i, i + IN_CHUNK),
          ),
          isNull(privateLocationToMonitors.deletedAt),
        ),
      )
      .groupBy(privateLocationToMonitors.monitorId);
    for (const row of rows) {
      if (row.monitorId !== null) locations.set(row.monitorId, row.count);
    }
  }

  return new Map(
    args.monitors.map((m) => [
      m.id,
      quorumPopulation({
        regions: m.regions,
        privateLocationCount: locations.get(m.id) ?? 0,
      }),
    ]),
  );
}

/**
 * One monitor's histogram rows → per-day quorum for its population. Days with
 * no run in scope get no entry, so they fall back to per-region counts.
 */
export function quorumByDay(
  rows: QuorumHistogramRow[],
  population: QuorumPopulation,
): Map<string, FrozenMonitorUptimeQuorum> {
  const out = new Map<string, FrozenMonitorUptimeQuorum>();
  if (population.regionCount <= 0) return out;
  for (const row of rows) {
    if (row.private !== population.private || row.runs <= 0) continue;
    const day = row.day.slice(0, 10);
    const quorum = out.get(day) ?? {
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
    out.set(day, quorum);
  }
  return out;
}
