import { createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";

import { UPTIME_METRICS } from "@/data/uptime-history.client";

export const searchParamsParsers = {
  metric: parseAsStringLiteral(UPTIME_METRICS).withDefault("requests"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
