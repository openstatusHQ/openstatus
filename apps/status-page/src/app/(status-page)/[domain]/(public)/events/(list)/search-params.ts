import { createSearchParamsCache, parseAsStringEnum } from "nuqs/server";

export const searchParamsParsers = {
  tab: parseAsStringEnum(["reports", "maintenances"]).withDefault("reports"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
