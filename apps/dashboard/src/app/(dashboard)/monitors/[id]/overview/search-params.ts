import { INTERVALS } from "@/data/metrics.client";
import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

const PERIOD = ["1d", "7d", "14d"] as const;
const PERCENTILE = ["p50", "p75", "p90", "p95", "p99"] as const;

export const searchParamsParsers = {
  period: parseAsStringLiteral(PERIOD).withDefault("1d"),
  regions: parseAsArrayOf(parseAsString),
  percentile: parseAsStringLiteral(PERCENTILE).withDefault("p50"),
  interval: parseAsNumberLiteral(INTERVALS).withDefault(30),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
