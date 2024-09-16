import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  section: parseAsString.withDefault("request"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
