import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  config: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
