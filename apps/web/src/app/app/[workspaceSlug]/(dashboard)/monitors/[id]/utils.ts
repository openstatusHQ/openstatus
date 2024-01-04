import {
  endOfDay,
  endOfHour,
  startOfDay,
  startOfHour,
  subDays,
  subHours,
} from "date-fns";

export const periods = ["1h", "1d", "3d"] as const; // If neeeded (e.g. Pro plans), "7d", "30d"
export const quantiles = ["p99", "p95", "p90", "p75", "avg"] as const;
export const intervals = ["1m", "10m", "30m", "1h"] as const;

export type Period = (typeof periods)[number];
export type Quantile = (typeof quantiles)[number];
export type Interval = (typeof intervals)[number];

export function getDateByPeriod(period: Period) {
  switch (period) {
    case "1h":
      return {
        from: subHours(startOfHour(new Date()), 1),
        to: endOfHour(new Date()),
      };
    case "1d":
      return {
        from: subDays(startOfHour(new Date()), 1),
        to: endOfDay(new Date()),
      };
    case "3d":
      return {
        from: subDays(startOfDay(new Date()), 3),
        to: endOfDay(new Date()),
      };
    default:
      const _exhaustiveCheck: never = period;
      throw new Error(`Unhandled period: ${_exhaustiveCheck}`);
  }
}

export function getMinutesByInterval(interval: Interval) {
  switch (interval) {
    case "1m":
      return 1;
    case "10m":
      return 10;
    case "30m":
      return 30;
    case "1h":
      return 60;
    default:
      const _exhaustiveCheck: never = interval;
      throw new Error(`Unhandled interval: ${_exhaustiveCheck}`);
  }
}
