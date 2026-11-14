import { TZDate } from "@date-fns/tz";
import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";

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

// [local midnight on the 1st, local midnight on the next 1st) in `timeZone`, as UTC ms
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
}): { days: FrozenMonitorUptimeDay[] } | null {
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

  return { days };
}
