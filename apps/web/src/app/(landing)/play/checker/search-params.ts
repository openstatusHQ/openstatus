import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  id: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
