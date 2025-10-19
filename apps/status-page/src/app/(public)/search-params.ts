import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  q: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
