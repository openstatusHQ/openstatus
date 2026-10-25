import {
  addDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";

export const ACTIVITY_WEEKS = 53;

export type ActivityRange = { from: Date; to: Date };

/** Monday-start weeks ending with the current one, so today sits in the last column. */
export function activityRange(now = new Date()): ActivityRange {
  const to = endOfWeek(now, { weekStartsOn: 1 });
  const from = startOfWeek(subWeeks(to, ACTIVITY_WEEKS - 1), {
    weekStartsOn: 1,
  });
  return { from, to };
}

export type ActivitySpan = { start: Date; end: Date | null };

export type ActivityDayItems<T> = { date: Date; items: T[] };

/**
 * One entry per day of the range, in order, with the items whose span
 * touches it. An open span (`end: null`) runs until `now`; anything outside
 * the range is clipped, not dropped.
 */
export function groupByDay<T>(
  range: ActivityRange,
  items: T[],
  span: (item: T) => ActivitySpan,
  now = new Date(),
): ActivityDayItems<T>[] {
  const days = eachDayOfInterval({ start: range.from, end: range.to }).map(
    (date) => ({
      date,
      items: [] as T[],
    }),
  );
  const index = new Map(days.map((day, i) => [dayKey(day.date), i]));
  for (const item of items) {
    const { start, end } = span(item);
    const stop = (end ?? now).getTime();
    // a span ending exactly at midnight doesn't touch the next day
    const exclusive =
      end !== null &&
      stop > start.getTime() &&
      stop === startOfDay(stop).getTime();
    const first = new Date(Math.max(start.getTime(), range.from.getTime()));
    const last = new Date(
      Math.min(exclusive ? stop - 1 : stop, range.to.getTime()),
    );
    if (last < first) continue;
    for (const date of eachDayOfInterval({ start: first, end: last })) {
      const i = index.get(dayKey(date));
      if (i !== undefined) days[i].items.push(item);
    }
  }
  return days;
}

export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** How long of a span falls inside the range (ms); an open span ends at `now`. */
export function spanInRange(
  range: ActivityRange,
  { start, end }: ActivitySpan,
  now = new Date(),
): number {
  const first = Math.max(start.getTime(), range.from.getTime());
  const last = Math.min((end ?? now).getTime(), range.to.getTime());
  return Math.max(0, last - first);
}

export function overlapsRange(
  range: ActivityRange,
  { start, end }: ActivitySpan,
  now = new Date(),
): boolean {
  return start <= range.to && (end ?? now) >= range.from;
}

/**
 * How much of `date`'s calendar day the spans cover (ms), overlaps counted
 * once; an open span ends at `now`.
 */
export function spansOnDay(
  date: Date,
  spans: ActivitySpan[],
  now = new Date(),
): number {
  const from = startOfDay(date).getTime();
  const to = addDays(from, 1).getTime();
  const clipped = spans
    .map(({ start, end }) => [
      Math.max(start.getTime(), from),
      Math.min((end ?? now).getTime(), to),
    ])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let reach = from;
  for (const [a, b] of clipped) {
    if (b <= reach) continue;
    total += b - Math.max(a, reach);
    reach = b;
  }
  return total;
}

/** 0–100, clamped; where a date sits on an axis spanning the range. */
export function percentInRange(range: ActivityRange, date: Date): number {
  const total = range.to.getTime() - range.from.getTime();
  const at = ((date.getTime() - range.from.getTime()) / total) * 100;
  return Math.min(100, Math.max(0, at));
}

/** First day of every month inside the range, with its axis position. */
export function monthsInRange(
  range: ActivityRange,
): { date: Date; at: number }[] {
  return eachMonthOfInterval({ start: range.from, end: range.to })
    .filter((date) => date >= range.from)
    .map((date) => ({ date, at: percentInRange(range, date) }));
}

/** 1–3 by thresholds: below the first, below the second, else the top. */
export function levelFor(
  value: number,
  [low, high]: [number, number],
): 1 | 2 | 3 {
  if (value < low) return 1;
  if (value < high) return 2;
  return 3;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Tooltip lines under the date: the lead, then "+2 canceled" or "+3 more". */
export function activityDayLines(lead: string, others: string[]): string[] {
  if (others.length === 0) return [lead];
  const same = others.every((o) => o === others[0]);
  return [lead, `+${others.length} ${same ? others[0].toLowerCase() : "more"}`];
}

/** The mark with the highest level; hatched ones are level 0, so any real event outranks them. */
export function strongestMark<T extends { level: number }>(
  marks: T[],
): T | null {
  let best: T | null = null;
  for (const mark of marks) {
    if (!best || mark.level > best.level) best = mark;
  }
  return best;
}
