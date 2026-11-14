import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  /** YYYY-MM in the reporting's zone; the previous month when absent */
  month: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
