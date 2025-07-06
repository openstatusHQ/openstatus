import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

export const searchParamsParsers = {
  config: parseAsString,
  channel: parseAsStringEnum(["pagerduty"]),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
