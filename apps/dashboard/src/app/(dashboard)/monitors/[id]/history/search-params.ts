import {
  createSearchParamsCache,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { HISTORY_SOURCES } from "@/data/monitor-history.client";
import { HISTORY_PERIODS } from "@/data/uptime-history.client";

export const searchParamsParsers = {
  source: parseAsStringLiteral(HISTORY_SOURCES).withDefault("outages"),
  // no default: an absent period is a year, or all the plan keeps
  period: parseAsNumberLiteral(HISTORY_PERIODS),
  // YYYY-MM; absent or outside the period, the month in progress
  month: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
