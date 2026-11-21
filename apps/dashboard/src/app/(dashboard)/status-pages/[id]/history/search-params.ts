import { createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";

import { HISTORY_METRICS } from "@/data/status-page-history";

export const searchParamsParsers = {
  // no default: an absent metric follows the page mode (historyMetric)
  metric: parseAsStringLiteral(HISTORY_METRICS),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
