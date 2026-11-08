export type Counts = { ok: number; degraded: number; error: number };

/** Region checks, plus run verdicts under the region quorum when known. */
export type DayCounts = { requests: Counts; runs?: Counts };

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

// a day without run verdicts keeps its ratio, expressed in run equivalents
function dayCounts(day: DayCounts, regionCount: number | null): Counts {
  if (regionCount === null || regionCount <= 0) return day.requests;
  if (day.runs) return day.runs;
  return {
    ok: day.requests.ok / regionCount,
    degraded: day.requests.degraded / regionCount,
    error: day.requests.error / regionCount,
  };
}

/** One set of counts as a tally, with the day status the bars show. */
export function tallyCounts({ ok, degraded, error }: Counts): DayTally {
  return {
    up: ok + degraded,
    total: ok + degraded + error,
    ok,
    degraded,
    error,
    // rounded like the shown counts, so a red day always shows an error count
    // and a day whose counts all round to 0 is empty
    status:
      roundCount(error) > 0
        ? "error"
        : roundCount(degraded) > 0
          ? "degraded"
          : roundCount(ok) > 0
            ? "success"
            : "empty",
  };
}

/**
 * `regionCount` is the monitor's quorum population: every day is counted in
 * runs, from `runs` or else `requests / regionCount`. `null` counts `requests`.
 */
export function tallyDay(day: DayCounts, regionCount: number | null): DayTally {
  return tallyCounts(dayCounts(day, regionCount));
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

/** Shown counts over buckets: sums of each bucket's shown counts, so they match a per-bucket chart. */
export function shownBuckets(
  days: DayCounts[],
  regionCount: number | null,
): Counts {
  const sum = { ok: 0, degraded: 0, error: 0 };
  for (const day of days) {
    const { ok, degraded, error } = shownCounts(tallyDay(day, regionCount));
    sum.ok += ok;
    sum.degraded += degraded;
    sum.error += error;
  }
  return sum;
}

/** Shown total over buckets, see `shownBuckets`. */
export function shownTotal(
  days: DayCounts[],
  regionCount: number | null,
): number {
  const { ok, degraded, error } = shownBuckets(days, regionCount);
  return ok + degraded + error;
}
