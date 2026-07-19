import { createSearchParamsCache, parseAsNumberLiteral } from "nuqs/server";

import { HISTORY_WINDOWS } from "@/data/status-page-history";

export const searchParamsParsers = {
  window: parseAsNumberLiteral(HISTORY_WINDOWS).withDefault(6),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
