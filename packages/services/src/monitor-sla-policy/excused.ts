import { monthRange } from "../frozen-uptime/compute";
import { addCounts, type Counts } from "../frozen-uptime/quorum";
import { quorumRegionCount } from "../frozen-uptime/quorum";
import {
  FREEZE_CUTOFF_MS,
  fetchRunCounts,
  hasRuns,
  type UptimeRunsRangePipes,
} from "../frozen-uptime/run";
import { completeMonths, monthCellKey, monthOf, splitByMonth } from "./months";

export type Span = { start: number; end: number };

/** Windows merged into disjoint spans, so overlapping windows excuse a run once. */
export function mergeSpans(
  windows: readonly { from: Date; to: Date }[],
): Span[] {
  const sorted = windows
    .map((w) => ({ start: w.from.getTime(), end: w.to.getTime() }))
    .filter((s) => s.start < s.end)
    .sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of sorted) {
    const last = merged.at(-1);
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

/** The parts of `spans` inside the month. */
export function spansInMonth(
  spans: readonly Span[],
  month: string,
  timeZone = "UTC",
): Span[] {
  const bounds = monthRange(month, timeZone);
  return spans
    .map((s) => ({
      start: Math.max(s.start, bounds.start),
      end: Math.min(s.end, bounds.end),
    }))
    .filter((s) => s.start < s.end);
}

/**
 * Excused run verdicts per `monthCellKey` from the range endpoints. Never throws or
 * reports zero for what it could not read: failed reads land in `failed`, too-old months in `expired`,
 * members whose current type or regions give no run verdicts in `unreadable`.
 */
export async function fetchExcusedCounts(args: {
  monitors: readonly { id: number; jobType: string; regions: string }[];
  spans: readonly Span[];
  months: readonly string[];
  now: Date;
  pipes: () => UptimeRunsRangePipes;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{
  counts: Map<string, Counts>;
  failed: Set<string>;
  expired: Set<string>;
  unreadable: Set<string>;
}> {
  const counts = new Map<string, Counts>();
  const failed = new Set<string>();
  const expired = new Set<string>();
  const unreadable = new Set<string>();
  const readable = args.monitors.filter(
    (m) => hasRuns(m.jobType) && quorumRegionCount(m.regions) !== null,
  );
  const now = args.now.getTime();
  let pipes: UptimeRunsRangePipes | undefined;
  for (const month of args.months) {
    const parts = spansInMonth(args.spans, month).filter((s) => s.start < now);
    if (parts.length === 0 || args.monitors.length === 0) continue;
    if (parts.some((s) => now - s.start >= FREEZE_CUTOFF_MS)) {
      for (const m of args.monitors) expired.add(monthCellKey(m.id, month));
      continue;
    }
    for (const m of args.monitors) {
      if (!readable.includes(m)) unreadable.add(monthCellKey(m.id, month));
    }
    if (readable.length === 0) continue;
    pipes ??= args.pipes();
    for (const part of parts) {
      const res = await fetchRunCounts({
        monitors: readable,
        pipes,
        from: new Date(part.start),
        to: new Date(part.end),
        throttleMs: 0,
        sleep: args.sleep,
      });
      for (const id of res.failedMonitorIds)
        failed.add(monthCellKey(id, month));
      for (const [id, c] of res.counts) {
        addCounts(counts, monthCellKey(id, month), c);
      }
    }
  }
  for (const key of failed) counts.delete(key);
  return { counts, failed, expired, unreadable };
}

/** Why a window cannot be added or removed: it touches a sealed month, a month before the previous one, or a future month. */
export function excusedWindowLock(
  window: { from: Date; to: Date },
  args: {
    now: Date;
    sealed: readonly { month: string }[];
    timeZone?: string;
  },
): "sealed" | "closed" | null {
  const { timeZone = "UTC" } = args;
  const from = window.from.getTime();
  const to = window.to.getTime();
  for (const s of args.sealed) {
    const { start, end } = monthRange(s.month, timeZone);
    if (from < end && start < to) return "sealed";
  }
  const [previous] = completeMonths(args.now, 1, timeZone);
  const current = monthOf(args.now, timeZone);
  if (
    splitByMonth(from, to, timeZone).some(
      (p) => p.month < previous || p.month > current,
    )
  ) {
    return "closed";
  }
  return null;
}
