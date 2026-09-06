import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  session: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
