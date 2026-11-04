import { eachDayOfInterval, endOfYear, startOfYear } from "date-fns";

import type { ActivityDay } from "@/components/content/activity-calendar";
import { dayKey, levelFor } from "@/data/activity.client";
import { formatNumber } from "@/lib/formatter";

export type CheckCounts = {
  day: string;
  ok: number;
  degraded: number;
  error: number;
};

export type UptimeYear = {
  year: number;
  days: ActivityDay[];
  /** (ok + degraded) / total, null without a single check */
  uptime: number | null;
  /** days with at least one failed check */
  failedDays: number;
};

/** Truncated, never rounded up: 99.9999% must not read as 100%. */
export function formatUptime(ratio: number, digits = 2): string {
  const factor = 10 ** digits;
  return `${(Math.floor(ratio * 100 * factor) / factor).toFixed(digits)}%`;
}

/** Green without failures, else by failed share of the day's checks: under 1%, 1 to 5%, over 5%. */
function dayMark(counts: CheckCounts | undefined): Partial<ActivityDay> {
  const total = counts ? counts.ok + counts.degraded + counts.error : 0;
  // a day without checks is no data, never downtime
  if (!counts || total === 0) return { hatched: true, lines: ["No checks"] };
  const { degraded, error } = counts;
  return {
    // degraded counts as up, like the uptime math
    ...(error === 0
      ? { scale: "success" as const, level: 1 as const }
      : {
          scale: "failure" as const,
          level: levelFor(error / total, [0.01, 0.05]),
        }),
    lines: [
      `${formatUptime((total - error) / total)} uptime`,
      [
        `${formatNumber(total)} checks`,
        ...(error > 0 ? [`${formatNumber(error)} failed`] : []),
        ...(degraded > 0 ? [`${formatNumber(degraded)} degraded`] : []),
      ].join(" · "),
    ],
  };
}

/**
 * One calendar per year, newest first, from the oldest recorded day's year;
 * days before the first check are blank, days after today are left empty.
 */
export function uptimeYears(counts: CheckCounts[], now = new Date()) {
  // frozen months are zero-filled: the record starts at the first checked day
  const since = counts.find((c) => c.ok + c.degraded + c.error > 0)?.day;
  if (!since) return [];
  const byDay = new Map(counts.map((c) => [c.day, c]));
  const first = Number(since.slice(0, 4));
  const years: UptimeYear[] = [];
  for (let year = now.getFullYear(); year >= first; year--) {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(start);
    let up = 0;
    let total = 0;
    let failedDays = 0;
    const days = eachDayOfInterval({ start, end }).map((date) => {
      const key = dayKey(date);
      if (date > now) return { date };
      if (key < since) return { date, blank: true };
      const c = byDay.get(key);
      if (c) {
        up += c.ok + c.degraded;
        total += c.ok + c.degraded + c.error;
        if (c.error > 0) failedDays++;
      }
      return { date, ...dayMark(c) };
    });
    years.push({
      year,
      days,
      uptime: total > 0 ? up / total : null,
      failedDays,
    });
  }
  return years;
}

/** Placeholder behind the upgrade overlay; seeded so it never reshuffles. */
export function exampleUptimeCounts(now = new Date()): CheckCounts[] {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const start = startOfYear(new Date(now.getFullYear() - 1, 0, 1));
  return eachDayOfInterval({ start, end: now }).map((date) => {
    const r = random();
    const error = r > 0.97 ? Math.ceil(random() * 90) : r > 0.9 ? 1 : 0;
    const degraded = random() > 0.85 ? Math.ceil(random() * 12) : 0;
    return { day: dayKey(date), ok: 1440 - error - degraded, degraded, error };
  });
}
