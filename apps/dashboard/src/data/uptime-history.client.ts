import {
  type DayCounts,
  tallyDay,
} from "@openstatus/services/status-timeline/tally";
import { eachDayOfInterval, endOfYear, format, startOfYear } from "date-fns";

import type { ActivityDay } from "@/components/content/activity-calendar";
import { dayKey } from "@/data/activity.client";
import { formatNumber } from "@/lib/formatter";

export type CheckCounts = DayCounts & { day: string };

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
  // epsilon: 0.57 * 100 * 100 is 5699.999…, which would floor to 56.99%
  return `${(Math.floor(ratio * 100 * factor + 1e-9) / factor).toFixed(digits)}%`;
}

/** Muted without failures, else by failed share of the day's checks: < 1%, ≤ 5%, > 5%. */
function dayMark(counts: CheckCounts | undefined): Partial<ActivityDay> {
  const tally = counts ? tallyDay(counts) : null;
  // a day without checks is no data, never downtime
  if (!tally || tally.total === 0)
    return { hatched: true, lines: ["No checks"] };
  const { total, degraded, error } = tally;
  const failed = error / total;
  return {
    // degraded counts as up, like the uptime math
    scale: "failure",
    level: error === 0 ? 0 : failed < 0.01 ? 1 : failed <= 0.05 ? 2 : 3,
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

/** First UTC day whose counts are runs judged on quorum, as a local-midnight date. */
export function quorumSince(counts: CheckCounts[]): Date | null {
  const first = counts
    .filter((d) => d.quorum)
    .reduce<string | null>(
      (min, d) => (!min || d.day < min ? d.day : min),
      null,
    );
  if (!first) return null;
  const [y, m, d] = first.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function quorumNote(since: Date): string {
  return `Since ${format(since, "MMMM yyyy")}, a check covers all of the monitor's regions and counts as down when at least half of them fail.`;
}

/** Today's UTC day as a local-midnight date, so calendar cells line up with the UTC day keys. */
export function utcToday(now = new Date()) {
  return new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * One calendar per year, newest first, from the oldest recorded day's year;
 * days before the first check are blank, days after today (UTC) are left empty.
 */
export function uptimeYears(counts: CheckCounts[], now = new Date()) {
  // frozen months are zero-filled: the record starts at the first checked day
  const since = counts.find((c) => tallyDay(c).total > 0)?.day;
  if (!since) return [];
  const byDay = new Map(counts.map((c) => [c.day, c]));
  const first = Number(since.slice(0, 4));
  const today = utcToday(now);
  const years: UptimeYear[] = [];
  for (let year = today.getFullYear(); year >= first; year--) {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(start);
    let up = 0;
    let total = 0;
    let failedDays = 0;
    const days = eachDayOfInterval({ start, end }).map((date) => {
      const key = dayKey(date);
      if (date > today) return { date };
      if (key < since) return { date, blank: true };
      const c = byDay.get(key);
      if (c) {
        const tally = tallyDay(c);
        up += tally.up;
        total += tally.total;
        if (tally.error > 0) failedDays++;
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
  const end = utcToday(now);
  const start = startOfYear(new Date(end.getFullYear() - 1, 0, 1));
  return eachDayOfInterval({ start, end }).map((date) => {
    const r = random();
    const error = r > 0.97 ? Math.ceil(random() * 90) : r > 0.9 ? 1 : 0;
    const degraded = random() > 0.85 ? Math.ceil(random() * 12) : 0;
    return { day: dayKey(date), ok: 1440 - error - degraded, degraded, error };
  });
}
