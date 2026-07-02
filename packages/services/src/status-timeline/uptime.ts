import {
  LEGACY_IMPACT_WEIGHT,
  impactUptimeWeight,
} from "@openstatus/db/src/schema";

import { type WeightedInterval, mergedDowntimeMs } from "./downtime";
import type { Event } from "./events";

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
function clipToCoverage(
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

// floor so a single failed check never rounds up to 100.00
export function floorPct(ratio: number): number {
  return Math.floor(ratio * 10_000) / 100;
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

function clampInterval(
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

function downtimeIntervals(
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
