import { type CdnProvider, inferTopology } from "@openstatus/header-analysis";
import type { CdnRegionResponse, CdnSummary } from "./schema";

// STALE counts as cached: the response was served from the edge cache
// (stale-while-revalidate), not from origin
const CACHED_STATUSES = new Set(["HIT", "STALE"]);

export function computeCdnSummary(rows: CdnRegionResponse[]): CdnSummary {
  const responded = rows.filter((row) => row.state === "success");
  const unreachable = rows.filter((row) => row.state === "error");

  const cached = responded.filter((row) =>
    CACHED_STATUSES.has(row.cacheStatus),
  );
  const uncached = responded.filter(
    (row) => !CACHED_STATUSES.has(row.cacheStatus),
  );

  const providerCounts = new Map<CdnProvider, number>();
  for (const row of responded) {
    if (!row.cdn) continue;
    providerCounts.set(row.cdn, (providerCounts.get(row.cdn) ?? 0) + 1);
  }
  const majority = [...providerCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const cdn = majority ? majority[0] : null;

  const topology = inferTopology(responded, cdn);

  return {
    type: "summary",
    totalRegions: rows.length,
    respondedRegions: responded.length,
    cachedRegions: cached.length,
    uncachedRegions: uncached.map((row) => row.region),
    unreachableRegions: unreachable.map((row) => row.region),
    cdn,
    mixedCdn: providerCounts.size > 1,
    topology: topology.topology,
    topologyBasis: topology.basis,
  };
}
