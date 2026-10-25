import {
  addDays,
  addWeeks,
  differenceInCalendarWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";

export const ACTIVITY_WEEKS = 53;

export type ActivityRange = { from: Date; to: Date };

/** Weeks the grid looks ahead for scheduled work, at most. */
const ACTIVITY_WEEKS_AHEAD = 4;

/**
 * Monday-start weeks ending with the current one, so today sits in the last
 * column; `until` extends it to that day's week, capped at ACTIVITY_WEEKS_AHEAD.
 */
export function activityRange(now = new Date(), until?: Date): ActivityRange {
  const current = endOfWeek(now, { weekStartsOn: 1 });
  const from = startOfWeek(subWeeks(current, ACTIVITY_WEEKS - 1), {
    weekStartsOn: 1,
  });
  const cap = addWeeks(current, ACTIVITY_WEEKS_AHEAD);
  const to =
    until && until > current
      ? endOfWeek(until < cap ? until : cap, { weekStartsOn: 1 })
      : current;
  return { from, to };
}

/** "Last 12 months", plus "· next 2 weeks" when the range looks ahead. */
export function activityPeriod(range: ActivityRange, now = new Date()): string {
  const ahead = differenceInCalendarWeeks(range.to, now, { weekStartsOn: 1 });
  if (ahead <= 0) return "Last 12 months";
  return `Last 12 months · next ${ahead} ${ahead === 1 ? "week" : "weeks"}`;
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

/** 1–3 by thresholds: below the first, below the second, else the top. */
export function levelFor(
  value: number,
  [low, high]: [number, number],
): 1 | 2 | 3 {
  if (value < low) return 1;
  if (value < high) return 2;
  return 3;
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
