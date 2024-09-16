import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  redirectTo: parseAsString.withDefault("/app"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
