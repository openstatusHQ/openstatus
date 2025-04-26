import { createSearchParamsCache, parseAsNumberLiteral } from "nuqs/server";

export const searchParamsParsers = {
  step: parseAsNumberLiteral([1, 2, 3]),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
