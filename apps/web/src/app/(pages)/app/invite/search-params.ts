import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  token: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
