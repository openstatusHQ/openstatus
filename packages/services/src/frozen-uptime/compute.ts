import { TZDate } from "@date-fns/tz";
import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";

import { type BadBucket, dayRangesAddUp, toRanges } from "./buckets";
import type { Counts } from "./quorum";

export type ComputeCountRow = {
  monitorId: string;
  day: string; // ISO or YYYY-MM-DD; sliced to YYYY-MM-DD here
  ok: number;
  degraded: number;
  error: number;
};

// UTC first-of-month of the month before `now`, YYYY-MM-01
export function previousMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-01`;
}

// [start of month, start of next month) in `timeZone`, as epoch ms
export function monthRange(
  month: string,
  timeZone = "UTC",
): { start: number; end: number } {
  const [year, mo] = month.split("-").map(Number);
  return {
    start: new TZDate(year, mo - 1, 1, timeZone).getTime(),
    end: new TZDate(year, mo, 1, timeZone).getTime(),
  };
}

export function monthDays(month: string): string[] {
  const [year, mo] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  const prefix = month.slice(0, 8); // YYYY-MM-
  return Array.from(
    { length: count },
    (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`,
  );
}

export type BadBucketRow = BadBucket & {
  day: string; // ISO or YYYY-MM-DD; sliced to YYYY-MM-DD here
};

type DayBad = NonNullable<FrozenMonitorUptimeDay["bad"]>;

function rangesByDay(rows: BadBucketRow[]) {
  const byDay = new Map<string, BadBucket[]>();
  for (const row of rows) {
    const day = row.day.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(row);
    else byDay.set(day, [row]);
  }
  return new Map([...byDay].map(([day, list]) => [day, toRanges(list)]));
}

/**
 * Pure assembly of one monitor's frozen month from already-fetched count
 * rows — no I/O. Returns null when the monitor has no counts in the month
 * (paused, or created later): no row is frozen rather than an all-zero month.
 */
export function computeMonitorMonth(args: {
  month: string; // YYYY-MM-01
  monitorId: number;
  counts: ComputeCountRow[];
  runs?: Map<string, Counts>;
  // the monitor's failing quarter-hours; omitted when not fetched
  bad?: { requests: BadBucketRow[]; runs: BadBucketRow[] };
}): { days: FrozenMonitorUptimeDay[]; bucketMismatch: boolean } | null {
  const { month, monitorId, counts, runs } = args;
  const prefix = month.slice(0, 8); // YYYY-MM-

  // sum rather than overwrite: the pipe aggregates per day today, but a
  // silent overwrite here would freeze truncated counts permanently
  const byDay = new Map<string, Counts>();
  for (const row of counts) {
    if (row.monitorId !== String(monitorId)) continue;
    const day = row.day.slice(0, 10);
    if (!day.startsWith(prefix)) continue;
    const acc = byDay.get(day) ?? { ok: 0, degraded: 0, error: 0 };
    acc.ok += row.ok;
    acc.degraded += row.degraded;
    acc.error += row.error;
    byDay.set(day, acc);
  }
  if (byDay.size === 0) return null;

  const days = monthDays(month).map((day) => {
    const dayRuns = runs?.get(day);
    return {
      day,
      requests: byDay.get(day) ?? { ok: 0, degraded: 0, error: 0 },
      ...(dayRuns ? { runs: dayRuns } : {}),
    };
  });

  if (!args.bad) return { days, bucketMismatch: false };
  return attachBadRanges(days, args.bad);
}

/**
 * Add the failing quarter-hours to a month's days, or none of them when any
 * day's ranges do not sum to its degraded and error counts.
 */
export function attachBadRanges(
  days: FrozenMonitorUptimeDay[],
  bad: { requests: BadBucketRow[]; runs: BadBucketRow[] },
): { days: FrozenMonitorUptimeDay[]; bucketMismatch: boolean } {
  const requestRanges = rangesByDay(bad.requests);
  const runRanges = rangesByDay(bad.runs);
  const withBad: FrozenMonitorUptimeDay[] = [];
  for (const d of days) {
    const dayBad: DayBad = {};
    const req = requestRanges.get(d.day);
    const run = runRanges.get(d.day);
    if (req?.length) dayBad.requests = req;
    if (run?.length) dayBad.runs = run;
    const next = { ...d, bad: dayBad };
    // ranges that disagree with the day counts would regroup into wrong days
    if (!dayRangesAddUp(next)) return { days, bucketMismatch: true };
    withBad.push(dayBad.requests || dayBad.runs ? next : d);
  }

  return { days: withBad, bucketMismatch: false };
}
