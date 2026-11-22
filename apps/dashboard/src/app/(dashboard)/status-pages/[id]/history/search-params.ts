import { createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";

import { UPTIME_MODE_VALUES } from "@/data/uptime-calculation.client";

export const searchParamsParsers = {
  // no default: an absent calculation is the page's own (configuredMode)
  calculation: parseAsStringLiteral(UPTIME_MODE_VALUES),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
