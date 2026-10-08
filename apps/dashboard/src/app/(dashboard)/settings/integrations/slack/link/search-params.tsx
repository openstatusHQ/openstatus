import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  token: parseAsString.withDefault(""),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
