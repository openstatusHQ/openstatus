import {
  type DayCounts,
  shownCounts,
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

/** Run counts when the monitor has a quorum region count, else region results. */
function countUnit(count: number, regionCount: number | null) {
  if (regionCount !== null) return count === 1 ? "run" : "runs";
  return count === 1 ? "check" : "checks";
}

/** Muted without failures, else by failed share of the day's runs: < 1%, ≤ 5%, > 5%. */
function dayMark(
  counts: CheckCounts | undefined,
  regionCount: number | null,
): Partial<ActivityDay> {
  const tally = counts ? tallyDay(counts, regionCount) : null;
  const shown = tally ? shownCounts(tally) : null;
  const shownTotal = shown ? shown.ok + shown.degraded + shown.error : 0;
  // a day without a shown check is no data, never downtime
  if (!tally || !shown || shownTotal === 0)
    return { hatched: true, lines: ["No checks"] };
  const { total } = tally;
  const failed = tally.error / total;
  return {
    // degraded counts as up, like the uptime math
    scale: "failure",
    level:
      tally.status !== "error" ? 0 : failed < 0.01 ? 1 : failed <= 0.05 ? 2 : 3,
    lines: [
      `${formatUptime((total - tally.error) / total)} uptime`,
      [
        `${formatNumber(shownTotal)} ${countUnit(shownTotal, regionCount)}`,
        ...(shown.error > 0 ? [`${formatNumber(shown.error)} failed`] : []),
        ...(shown.degraded > 0
          ? [`${formatNumber(shown.degraded)} degraded`]
          : []),
      ].join(" · "),
    ],
  };
}

/** First UTC day with run verdicts, as a local-midnight date. */
export function quorumSince(
  counts: CheckCounts[],
  regionCount: number | null,
): Date | null {
  if (regionCount === null) return null;
  const first = counts
    .filter((d) => d.runs)
    .reduce<string | null>(
      (min, d) => (!min || d.day < min ? d.day : min),
      null,
    );
  if (!first) return null;
  const [y, m, d] = first.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** `page` qualifies the note for a page that can mix cloud and private-only monitors. */
export function quorumNote(
  since: Date,
  scope: "monitor" | "page" = "monitor",
): string {
  const month = format(since, "MMMM yyyy");
  if (scope === "page") {
    return `Since ${month}, for HTTP, TCP, DNS, ICMP and gRPC monitors with cloud regions, a run covers all of a monitor's cloud regions and counts as down when at least half of them fail. Earlier runs are region results divided by the number of regions. Monitors with only private locations count each region's result.`;
  }
  return `Since ${month}, a run covers all of the monitor's cloud regions and counts as down when at least half of them fail. Earlier runs are region results divided by the number of regions.`;
}

/** Today's UTC day as a local-midnight date, so calendar cells line up with the UTC day keys. */
export function utcToday(now = new Date()) {
  return new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * One calendar per year, newest first, from the oldest recorded day's year;
 * days before the first check are blank, days after today (UTC) are left empty.
 */
export function uptimeYears(
  counts: CheckCounts[],
  regionCount: number | null,
  now = new Date(),
) {
  // frozen months are zero-filled: the record starts at the first checked day
  const since = counts.find((c) => tallyDay(c, regionCount).total > 0)?.day;
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
        const tally = tallyDay(c, regionCount);
        up += tally.up;
        total += tally.total;
        if (tally.status === "error") failedDays++;
      }
      return { date, ...dayMark(c, regionCount) };
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
    return {
      day: dayKey(date),
      requests: { ok: 1440 - error - degraded, degraded, error },
    };
  });
}
