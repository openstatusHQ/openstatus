import { intervals, quantiles } from "@/lib/monitor/utils";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsInteger,
  parseAsStringLiteral,
} from "nuqs/server";

export const DEFAULT_QUANTILE = "p95";
export const DEFAULT_INTERVAL = "30m";
export const DEFAULT_PERIOD = "1d";

export const periods = ["1d", "7d", "14d"] as const;

export const searchParamsParsers = {
  statusCode: parseAsInteger,
  cronTimestamp: parseAsInteger,
  quantile: parseAsStringLiteral(quantiles).withDefault(DEFAULT_QUANTILE),
  interval: parseAsStringLiteral(intervals).withDefault(DEFAULT_INTERVAL),
  period: parseAsStringLiteral(periods).withDefault(DEFAULT_PERIOD),
  regions: parseAsArrayOf(parseAsStringLiteral(flyRegions)).withDefault([
    ...flyRegions,
  ]),
};
export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
