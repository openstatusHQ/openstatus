import { createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";

const STEPS = ["1", "2", "next"] as const;

export const searchParamsParsers = {
  step: parseAsStringLiteral(STEPS).withDefault("1"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
