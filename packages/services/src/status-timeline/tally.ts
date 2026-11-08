// Type-only imports on purpose: status-page and dashboard client components import this.
import type { FrozenMonitorUptimeQuorum } from "@openstatus/db/src/schema";

export type DayCounts = {
  ok: number;
  degraded: number;
  error: number;
  quorum?: FrozenMonitorUptimeQuorum;
};

/**
 * Runs when the monitor has a quorum `regionCount`, else region checks.
 * Converted days may be fractional: show counts through `roundCount`.
 */
export type DayTally = {
  up: number;
  total: number;
  ok: number;
  degraded: number;
  error: number;
  status: "success" | "degraded" | "error" | "empty";
};

/** At least half of `total` affected — the same rule incidents open on. */
export function meetsQuorum(affected: number, total: number): boolean {
  return affected * 2 >= total;
}

function runCounts({ regionCount, buckets }: FrozenMonitorUptimeQuorum) {
  const counts = { ok: 0, degraded: 0, error: 0 };
  for (const { errorRegions, notOkRegions, runs } of buckets) {
    if (meetsQuorum(errorRegions, regionCount)) counts.error += runs;
    else if (meetsQuorum(notOkRegions, regionCount)) counts.degraded += runs;
    else counts.ok += runs;
  }
  return counts;
}

// a day without a histogram keeps its ratio, expressed in run equivalents
function dayCounts(day: DayCounts, regionCount: number | null) {
  if (regionCount === null || regionCount <= 0) return day;
  if (day.quorum && day.quorum.regionCount > 0) return runCounts(day.quorum);
  return {
    ok: day.ok / regionCount,
    degraded: day.degraded / regionCount,
    error: day.error / regionCount,
  };
}

/**
 * `regionCount` is the monitor's quorum population: every day is counted in
 * runs. `null` (no population) counts region checks and ignores `quorum`.
 */
export function tallyDay(day: DayCounts, regionCount: number | null): DayTally {
  const { ok, degraded, error } = dayCounts(day, regionCount);
  const total = ok + degraded + error;
  return {
    up: ok + degraded,
    total,
    ok,
    degraded,
    error,
    // rounded like the shown counts, so a red day always shows an error count;
    // quorum and per-region days are integers already
    status:
      roundCount(error) > 0
        ? "error"
        : roundCount(degraded) > 0
          ? "degraded"
          : total > 0
            ? "success"
            : "empty",
  };
}

/** Sums `tallyDay` over days or buckets of one monitor. */
export function tallyBuckets(
  days: DayCounts[],
  regionCount: number | null,
): { up: number; total: number } {
  let up = 0;
  let total = 0;
  for (const day of days) {
    const tally = tallyDay(day, regionCount);
    up += tally.up;
    total += tally.total;
  }
  return { up, total };
}

/** Counts are shown as integers; converted days carry fractions. */
export function roundCount(count: number): number {
  return Math.round(count);
}

/** One day's or bucket's counts as shown. */
export function shownCounts(tally: DayTally): {
  ok: number;
  degraded: number;
  error: number;
} {
  return {
    ok: roundCount(tally.ok),
    degraded: roundCount(tally.degraded),
    error: roundCount(tally.error),
  };
}

/** Shown total over buckets: the sum of each bucket's shown counts, so it matches a per-bucket chart. */
export function shownTotal(
  days: DayCounts[],
  regionCount: number | null,
): number {
  let total = 0;
  for (const day of days) {
    const { ok, degraded, error } = shownCounts(tallyDay(day, regionCount));
    total += ok + degraded + error;
  }
  return total;
}
