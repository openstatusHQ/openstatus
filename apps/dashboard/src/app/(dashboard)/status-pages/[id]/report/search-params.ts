import {
  createSearchParamsCache,
  parseAsNumberLiteral,
  parseAsStringLiteral,
} from "nuqs/server";

import { HISTORY_METRICS, HISTORY_WINDOWS } from "@/data/status-page-history";

export const searchParamsParsers = {
  window: parseAsNumberLiteral(HISTORY_WINDOWS).withDefault(6),
  // no default: an absent metric follows the page mode (historyMetric)
  metric: parseAsStringLiteral(HISTORY_METRICS),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
