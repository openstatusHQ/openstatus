import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  redirectTo: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
