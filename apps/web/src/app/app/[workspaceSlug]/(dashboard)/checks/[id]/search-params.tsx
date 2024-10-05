import { createSearchParamsCache, parseAsInteger } from "nuqs/server";

export const searchParamsParsers = {
  pageSize: parseAsInteger.withDefault(10),
  page: parseAsInteger.withDefault(0),
};
export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
