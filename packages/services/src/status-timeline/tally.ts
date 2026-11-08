// Type-only imports on purpose: status-page and dashboard client components import this.
import type { FrozenMonitorUptimeQuorum } from "@openstatus/db/src/schema";

export type DayCounts = {
  ok: number;
  degraded: number;
  error: number;
  quorum?: FrozenMonitorUptimeQuorum;
};

/** Counts are runs when the day carries a quorum histogram, else region checks. */
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

/** Whether `tallyDay` counts this day in runs rather than region checks. */
export function countsRuns(
  day: DayCounts,
): day is DayCounts & { quorum: FrozenMonitorUptimeQuorum } {
  return day.quorum !== undefined && day.quorum.regionCount > 0;
}

export function tallyDay(day: DayCounts): DayTally {
  const { ok, degraded, error } = countsRuns(day) ? runCounts(day.quorum) : day;
  const total = ok + degraded + error;
  return {
    up: ok + degraded,
    total,
    ok,
    degraded,
    error,
    status:
      error > 0
        ? "error"
        : degraded > 0
          ? "degraded"
          : total > 0
            ? "success"
            : "empty",
  };
}

/** Sums `tallyDay` over buckets; `runs` when any of them is counted in runs. */
export function tallyBuckets(days: DayCounts[]): {
  up: number;
  total: number;
  runs: boolean;
} {
  let up = 0;
  let total = 0;
  for (const day of days) {
    const tally = tallyDay(day);
    up += tally.up;
    total += tally.total;
  }
  return { up, total, runs: days.some(countsRuns) };
}
