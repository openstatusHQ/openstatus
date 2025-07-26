import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  redirectTo: parseAsString.withDefault("/"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
