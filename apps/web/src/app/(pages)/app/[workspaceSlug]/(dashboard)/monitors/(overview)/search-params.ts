import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const searchParamsParsers = {
  tags: parseAsArrayOf(parseAsString),
  public: parseAsArrayOf(parseAsBoolean),
  pageSize: parseAsInteger.withDefault(10),
  pageIndex: parseAsInteger.withDefault(0),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
