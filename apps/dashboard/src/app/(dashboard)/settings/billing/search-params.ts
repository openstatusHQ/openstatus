import { createSearchParamsCache, parseAsBoolean } from "nuqs/server";

export const searchParamsParsers = {
  success: parseAsBoolean,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
