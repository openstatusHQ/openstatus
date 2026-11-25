import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  redirectTo: parseAsString,
  error: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
