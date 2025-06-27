import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsStringEnum,
} from "nuqs/server";

export const searchParamsParsers = {
  status: parseAsStringEnum(["active", "degraded", "error"]),
  active: parseAsBoolean,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
