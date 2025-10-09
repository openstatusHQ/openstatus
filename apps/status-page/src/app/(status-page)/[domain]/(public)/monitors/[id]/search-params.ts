import { createSearchParamsCache, parseAsStringEnum } from "nuqs/server";

export const searchParamsParsers = {
  tab: parseAsStringEnum(["global", "region", "uptime"]).withDefault("global"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
