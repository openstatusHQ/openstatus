import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { REPORT_PERIODS } from "@/data/monitor-report.client";
import { HISTORY_METRICS } from "@/data/status-page-history";

export const searchParamsParsers = {
  period: parseAsStringLiteral(REPORT_PERIODS).withDefault("this-month"),
  // YYYY-MM-DD UTC days of a custom period
  from: parseAsString,
  to: parseAsString,
  metric: parseAsStringLiteral(HISTORY_METRICS).withDefault("requests"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
