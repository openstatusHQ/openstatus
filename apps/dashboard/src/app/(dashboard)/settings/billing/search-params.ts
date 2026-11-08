import { createSearchParamsCache, parseAsBoolean } from "nuqs/server";

export const searchParamsParsers = {
  success: parseAsBoolean,
  setup: parseAsBoolean,
  trial: parseAsBoolean,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
