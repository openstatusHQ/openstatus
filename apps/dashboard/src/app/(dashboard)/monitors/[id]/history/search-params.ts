import { createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";

import { HISTORY_METRICS } from "@/data/status-page-history";

export const searchParamsParsers = {
  metric: parseAsStringLiteral(HISTORY_METRICS).withDefault("requests"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
