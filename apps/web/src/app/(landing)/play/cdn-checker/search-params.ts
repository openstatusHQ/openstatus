import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  url: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
