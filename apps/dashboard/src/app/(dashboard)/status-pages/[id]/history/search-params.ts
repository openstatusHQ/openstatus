import {
  createSearchParamsCache,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { UPTIME_MODE_VALUES } from "@/data/uptime-calculation.client";
import { HISTORY_PERIODS } from "@/data/uptime-history.client";

export const searchParamsParsers = {
  // no default: an absent calculation is the page's own (configuredMode)
  calculation: parseAsStringLiteral(UPTIME_MODE_VALUES),
  // no default: an absent period is a year, or all the plan keeps
  period: parseAsNumberLiteral(HISTORY_PERIODS),
  // YYYY-MM; absent or outside the period, the month in progress
  month: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
