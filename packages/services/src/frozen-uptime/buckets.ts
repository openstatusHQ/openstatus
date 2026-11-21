import type {
  BadRange,
  FrozenMonitorUptimeDay,
} from "@openstatus/db/src/schema";

export const BUCKET_MINUTES = 15;
export const BUCKETS_PER_DAY = (24 * 60) / BUCKET_MINUTES;

export type BadBucket = { bucket: number; degraded: number; error: number };

/** Merge one day's failing quarter-hours into ranges of identical counts. */
export function toRanges(rows: BadBucket[]): BadRange[] {
  const byBucket = new Map<number, { degraded: number; error: number }>();
  for (const { bucket, degraded, error } of rows) {
    const acc = byBucket.get(bucket) ?? { degraded: 0, error: 0 };
    acc.degraded += degraded;
    acc.error += error;
    byBucket.set(bucket, acc);
  }

  const ranges: BadRange[] = [];
  const sorted = [...byBucket].sort(([a], [b]) => a - b);
  for (const [bucket, { degraded, error }] of sorted) {
    if (degraded + error === 0) continue;
    const last = ranges.at(-1);
    if (
      last &&
      last[0] + last[1] === bucket &&
      last[2] === degraded &&
      last[3] === error
    ) {
      last[1]++;
    } else {
      ranges.push([bucket, 1, degraded, error]);
    }
  }
  return ranges;
}

/** Sum of the ranges' failures inside buckets `[from, to)`. */
export function rangesInBuckets(
  ranges: BadRange[],
  from: number,
  to: number,
): { degraded: number; error: number } {
  let degraded = 0;
  let error = 0;
  for (const [first, count, d, e] of ranges) {
    const n = Math.min(first + count, to) - Math.max(first, from);
    if (n <= 0) continue;
    degraded += n * d;
    error += n * e;
  }
  return { degraded, error };
}

type Counts = { ok: number; degraded: number; error: number };

function addsUp(ranges: BadRange[] | undefined, counts: Counts | undefined) {
  const sum = rangesInBuckets(ranges ?? [], 0, BUCKETS_PER_DAY);
  return (
    sum.degraded === (counts?.degraded ?? 0) &&
    sum.error === (counts?.error ?? 0)
  );
}

/** Whether one day's bad ranges sum exactly to its degraded and error counts. */
export function dayRangesAddUp(d: FrozenMonitorUptimeDay): boolean {
  return addsUp(d.bad?.requests, d.requests) && addsUp(d.bad?.runs, d.runs);
}

/**
 * Whether a frozen month carries its failing quarter-hours: every day's
 * ranges account for its failures. A month without any failure qualifies.
 */
export function hasBadRanges(days: FrozenMonitorUptimeDay[]): boolean {
  return days.every(dayRangesAddUp);
}

const MS_PER_BUCKET = BUCKET_MINUTES * 60_000;

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const groupCache = new Map<
  string,
  { day: string; first: number; n: number }[]
>();

function localDate(at: number, timeZone: string): string {
  let format = dateFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormats.set(timeZone, format);
  }
  const parts = Object.fromEntries(
    format.formatToParts(at).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// consecutive buckets of one UTC day per local date; up to three with DST
function localGroups(day: string, timeZone: string) {
  const cacheKey = `${timeZone}|${day}`;
  const cached = groupCache.get(cacheKey);
  if (cached) return cached;
  const start = Date.parse(`${day}T00:00:00.000Z`);
  const groups: { day: string; first: number; n: number }[] = [];
  for (let i = 0; i < BUCKETS_PER_DAY; i++) {
    const local = localDate(start + i * MS_PER_BUCKET, timeZone);
    const last = groups.at(-1);
    if (last?.day === local) last.n++;
    else groups.push({ day: local, first: i, n: 1 });
  }
  if (groupCache.size > 20_000) groupCache.clear();
  groupCache.set(cacheKey, groups);
  return groups;
}

export type LocalDayCount = {
  day: string;
  ok: number;
  degraded: number;
  error: number;
};

/**
 * Regroup frozen UTC days into days of `timeZone`; totals turn fractional.
 * Months without their 15-minute ranges come back as UTC days unchanged.
 */
export function toLocalDays(
  days: FrozenMonitorUptimeDay[],
  timeZone: string,
  measure: "requests" | "runs",
  hasRanges = hasBadRanges(days),
): LocalDayCount[] {
  const regroup = timeZone !== "UTC" && hasRanges;
  const byDay = new Map<string, LocalDayCount>();
  const add = (day: string, ok: number, degraded: number, error: number) => {
    const acc = byDay.get(day) ?? { day, ok: 0, degraded: 0, error: 0 };
    acc.ok += ok;
    acc.degraded += degraded;
    acc.error += error;
    byDay.set(day, acc);
  };
  for (const d of days) {
    const counts = d[measure];
    if (!counts) continue;
    if (!regroup) {
      add(d.day, counts.ok, counts.degraded, counts.error);
      continue;
    }
    const dayTotal = counts.ok + counts.degraded + counts.error;
    const ranges = d.bad?.[measure] ?? [];
    const groups = localGroups(d.day, timeZone).map((g) => {
      const bad = rangesInBuckets(ranges, g.first, g.first + g.n);
      // checks spread evenly over the day; failures sit in their real buckets
      const share = (dayTotal * g.n) / BUCKETS_PER_DAY;
      return { ...g, bad, ok: Math.max(share - bad.degraded - bad.error, 0) };
    });
    // a sparse monitor can fail more often in a group than its even share:
    // rescale so the day keeps exactly its own passing checks
    const okSum = groups.reduce((sum, g) => sum + g.ok, 0);
    const scale = okSum > 0 ? counts.ok / okSum : 0;
    for (const g of groups) {
      add(g.day, g.ok * scale, g.bad.degraded, g.bad.error);
    }
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}
