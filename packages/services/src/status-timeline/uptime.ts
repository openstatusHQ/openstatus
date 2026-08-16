import {
  LEGACY_IMPACT_WEIGHT,
  impactUptimeWeight,
} from "@openstatus/db/src/schema";

import { type WeightedInterval, mergedDowntimeMs } from "./downtime";
import type { Event, StatusData } from "./events";

export const MS_PER_DAY = 86_400_000;

export type CheckCounts = { ok: number; degraded: number; error: number };

/** Downtime is clamped to [start, end]; `now` closes still-open events. */
export type UptimeWindow = { start: number; end: number; now: number };

/** Time actually covered by checks; downtime outside it must not count. */
export type CoverageSegment = { start: number; end: number };

/**
 * Day-granular coverage plus its total in one place — the denominator MUST
 * equal the covered time or clipped downtime is measured against the wrong
 * base. `clampEndMs` cuts the in-progress day to elapsed time.
 */
export function dayCoverage(
  dayStartsMs: number[],
  clampEndMs?: number,
): { segments: CoverageSegment[]; totalMs: number } {
  let totalMs = 0;
  const segments: CoverageSegment[] = [];
  for (const start of dayStartsMs) {
    const end =
      clampEndMs === undefined
        ? start + MS_PER_DAY
        : Math.min(start + MS_PER_DAY, clampEndMs);
    if (end <= start) continue;
    totalMs += end - start;
    segments.push({ start, end });
  }
  return { segments, totalMs };
}

// downtime during a coverage gap (paused monitor, missing data days) would
// exceed a days-with-checks denominator and fake 0% for a healthy monitor —
// clip every interval to the covered segments before merging
export function clipToCoverage(
  intervals: WeightedInterval[],
  coverage: CoverageSegment[],
): WeightedInterval[] {
  return intervals.flatMap((iv) =>
    coverage.flatMap((segment) => {
      const from = Math.max(iv.from, segment.start);
      const to = Math.min(iv.to, segment.end);
      return to > from ? [{ from, to, weight: iv.weight }] : [];
    }),
  );
}

// floor so a single failed check never rounds up to 100.000. the epsilon
// absorbs float error from the caller's a/b division (0.29 * 100_000 is
// 28999.999999999996) — it is ~450x the ULP at this scale, far too small to
// lift a genuinely-below value onto the next thousandth.
export function floorPct(ratio: number): number {
  return Math.floor(ratio * 100_000 + 1e-8) / 1_000;
}

export function requestsTally(counts: CheckCounts[]): {
  up: number;
  total: number;
} {
  let up = 0;
  let total = 0;
  for (const c of counts) {
    up += c.ok + c.degraded;
    total += c.ok + c.degraded + c.error;
  }
  return { up, total };
}

export function clampInterval(
  from: Date,
  to: Date | null,
  weight: number,
  window: UptimeWindow,
): WeightedInterval | null {
  const start = Math.max(from.getTime(), window.start);
  const end = Math.min(to ? to.getTime() : window.now, window.end);
  if (end <= start || weight === 0) return null;
  return { from: start, to: end, weight };
}

export function downtimeIntervals(
  events: Event[],
  window: UptimeWindow,
  reportsOnly: boolean,
): WeightedInterval[] {
  return events.flatMap((e) => {
    if (e.type === "incident") {
      if (reportsOnly) return [];
      return clampInterval(e.from, e.to, 1, window) ?? [];
    }
    if (e.type !== "report") return [];
    // empty array falls through: getEvents emits [] for a member component
    // no update ever impacted — treat like legacy, not like "no downtime"
    // (mirrors eventWorstImpact's length check in events.ts)
    if (e.impactIntervals?.length) {
      return e.impactIntervals.flatMap(
        (iv) =>
          clampInterval(
            iv.from,
            iv.to,
            impactUptimeWeight(iv.impact),
            window,
          ) ?? [],
      );
    }
    // legacy report (no impact rows): counts full-duration in reports-only
    // math, ignored in duration math to preserve pre-impact uptime values
    return reportsOnly
      ? (clampInterval(e.from, e.to, LEGACY_IMPACT_WEIGHT, window) ?? [])
      : [];
  });
}

/**
 * Duration-mode downtime: incidents (weight 1) + impact-weighted reports
 * share one merged timeline so an incident plus a report describing the same
 * outage counts once; legacy reports are ignored.
 */
export function durationDowntimeMs(
  events: Event[],
  window: UptimeWindow,
  coverage?: CoverageSegment[],
): number {
  const intervals = downtimeIntervals(events, window, false);
  return mergedDowntimeMs(
    coverage ? clipToCoverage(intervals, coverage) : intervals,
  );
}

/**
 * Reports-only downtime (manual mode, static components): impact-weighted
 * reports plus legacy reports at full weight; incidents are ignored.
 */
export function reportsOnlyDowntimeMs(
  events: Event[],
  window: UptimeWindow,
  coverage?: CoverageSegment[],
): number {
  const intervals = downtimeIntervals(events, window, true);
  return mergedDowntimeMs(
    coverage ? clipToCoverage(intervals, coverage) : intervals,
  );
}

/**
 * Probe-based downtime intervals: converts probe failure data into weighted
 * downtime intervals. Each day's error ratio becomes the weight for that day's
 * interval, allowing it to be merged with event-based downtime.
 */
export function probeDowntimeIntervals(
  data: StatusData[],
  window: UptimeWindow,
): WeightedInterval[] {
  const intervals: WeightedInterval[] = [];

  for (const item of data) {
    const dayStart = new Date(item.day).getTime();
    const dayEnd = dayStart + MS_PER_DAY;

    // Clamp to window
    const start = Math.max(dayStart, window.start);
    const end = Math.min(dayEnd, window.end);
    if (end <= start) continue;

    const totalChecks = item.ok + item.degraded + item.error;
    if (totalChecks === 0) continue;

    // Calculate error ratio as the weight
    // degraded counts as "up" (like in requestsTally), only errors count as down
    const errorRatio = item.error / totalChecks;
    if (errorRatio === 0) continue;

    intervals.push({
      from: start,
      to: end,
      weight: errorRatio,
    });
  }

  return intervals;
}
