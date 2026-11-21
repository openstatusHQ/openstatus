import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { HISTORY_METRICS } from "@/data/status-page-history";

export const searchParamsParsers = {
  // YYYY-MM UTC month, set only by links to outages older than the report
  month: parseAsString,
  metric: parseAsStringLiteral(HISTORY_METRICS).withDefault("requests"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
