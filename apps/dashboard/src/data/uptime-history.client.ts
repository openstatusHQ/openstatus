import { eachDayOfInterval, startOfYear } from "date-fns";

import { dayKey } from "@/data/activity.client";
import { calendarDate } from "@/data/monitor-history.client";

export const HISTORY_PERIODS = [3, 6, 12, 24] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

/** Months shown when none is picked: a year, or all the plan keeps. */
export const defaultHistoryPeriod = (limit: number) => Math.min(limit, 12);

/** Months the history spans: the picked period capped at the plan, a year without history. */
export const historyPeriodMonths = (period: number | null, limit: number) =>
  Math.min(period ?? defaultHistoryPeriod(limit), limit) || 12;

export type CheckCounts = {
  day: string;
  ok: number;
  degraded: number;
  error: number;
};

/** First UTC day with a count; frozen months are zero-filled before it. */
export function checkHistorySince(counts: CheckCounts[]): string | undefined {
  return counts.find((c) => c.ok + c.degraded + c.error > 0)?.day;
}

/** Placeholder behind the upgrade overlay; seeded so it never reshuffles. */
export function exampleUptimeCounts(now = new Date()): CheckCounts[] {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const end = calendarDate(now.toISOString().slice(0, 10));
  const start = startOfYear(new Date(end.getFullYear() - 1, 0, 1));
  return eachDayOfInterval({ start, end }).map((date) => {
    const r = random();
    const error = r > 0.97 ? Math.ceil(random() * 90) : r > 0.9 ? 1 : 0;
    const degraded = random() > 0.85 ? Math.ceil(random() * 12) : 0;
    return { day: dayKey(date), ok: 1440 - error - degraded, degraded, error };
  });
}
