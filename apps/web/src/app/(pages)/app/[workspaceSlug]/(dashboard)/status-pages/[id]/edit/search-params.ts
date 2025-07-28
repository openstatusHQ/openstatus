import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  section: parseAsString.withDefault("monitors"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
