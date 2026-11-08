import {
  createSearchParamsCache,
  parseAsNumberLiteral,
  parseAsStringLiteral,
} from "nuqs/server";

import { HISTORY_METRICS, HISTORY_WINDOWS } from "@/data/status-page-history";

export const searchParamsParsers = {
  window: parseAsNumberLiteral(HISTORY_WINDOWS).withDefault(6),
  metric: parseAsStringLiteral(HISTORY_METRICS).withDefault("requests"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
