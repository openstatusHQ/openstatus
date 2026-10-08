import { createSearchParamsCache, parseAsBoolean } from "nuqs/server";

export const searchParamsParsers = {
  success: parseAsBoolean,
  setup: parseAsBoolean,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
