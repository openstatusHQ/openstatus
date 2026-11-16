import { createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";

export const VIEWS = ["active", "archived"] as const;

export const searchParamsParsers = {
  view: parseAsStringLiteral(VIEWS).withDefault("active"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
