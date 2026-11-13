import { createSearchParamsCache, parseAsNumberLiteral } from "nuqs/server";

export const MONTH_RANGES = [12, 24] as const;

export const searchParamsParsers = {
  months: parseAsNumberLiteral(MONTH_RANGES).withDefault(12),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
