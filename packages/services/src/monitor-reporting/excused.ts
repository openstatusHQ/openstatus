import { monthRange } from "../frozen-uptime/compute";
import { completeMonths, monthOf, splitByMonth } from "./months";

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
