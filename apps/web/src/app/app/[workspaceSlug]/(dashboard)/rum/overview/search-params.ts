import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  path: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
