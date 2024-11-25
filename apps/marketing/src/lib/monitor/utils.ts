import {
  endOfDay,
  endOfHour,
  startOfDay,
  startOfHour,
  subDays,
  subHours,
} from "date-fns";

import type { MonitorPeriodicity } from "@openstatus/db/src/schema";

export const periods = ["1d", "7d", "14d"] as const; // If neeeded (e.g. Pro plans), "7d", "30d"
export const quantiles = ["p99", "p95", "p90", "p75", "p50"] as const;
export const intervals = ["1m", "10m", "30m", "1h"] as const;
export const triggers = ["cron", "api"] as const;

export type Period = (typeof periods)[number];
export type Quantile = (typeof quantiles)[number];
export type Interval = (typeof intervals)[number];
export type Trigger = (typeof triggers)[number];

export function getDateByPeriod(period: Period) {
  switch (period) {
    case "1d":
      return {
        from: subDays(startOfHour(new Date()), 1),
        to: endOfDay(new Date()),
      };
    case "7d":
      return {
        from: subDays(startOfDay(new Date()), 7),
        to: endOfDay(new Date()),
      };
    case "14d":
      return {
        from: subDays(startOfDay(new Date()), 14),
        to: endOfDay(new Date()),
      };
    default: {
      const _exhaustiveCheck: never = period;
      throw new Error(`Unhandled period: ${_exhaustiveCheck}`);
    }
  }
}

export function getHoursByPeriod(period: Period) {
  switch (period) {
    case "1d":
      return 24;
    case "7d":
      return 168;
    case "14d":
      return 336;
    default: {
      const _exhaustiveCheck: never = period;
      throw new Error(`Unhandled period: ${_exhaustiveCheck}`);
    }
  }
}

export function periodFormatter(period: Period) {
  switch (period) {
    case "1d":
      return "Last day";
    case "7d":
      return "Last 7 days";
    case "14d":
      return "Last 14 days";
    default: {
      const _exhaustiveCheck: never = period;
      return _exhaustiveCheck;
    }
  }
}

export function getMinutesByInterval(interval: MonitorPeriodicity) {
  switch (interval) {
    case "30s":
      // return 0.5;
      return 1; // FIX TINYBIRD
    case "1m":
      return 1;
    case "5m":
      return 5;
    case "10m":
      return 10;
    case "30m":
      return 30;
    case "1h":
      return 60;
    case "other":
      return 60; // TODO: remove "other" from here
    default: {
      const _exhaustiveCheck: never = interval;
      throw new Error(`Unhandled interval: ${_exhaustiveCheck}`);
    }
  }
}
