import { createSearchParamsCache, parseAsInteger } from "nuqs/server";

export const searchParamsParsers = {
  pageIndex: parseAsInteger.withDefault(1),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
