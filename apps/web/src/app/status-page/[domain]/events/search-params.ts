import { createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";

export const searchParamsParsers = {
  filter: parseAsStringLiteral(["all", "maintenances", "reports"]).withDefault(
    "all",
  ),
};
export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
