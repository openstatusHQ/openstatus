import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

export const searchParamsParsers = {
  success: parseAsBoolean,
  setup: parseAsBoolean,
  trial: parseAsBoolean,
  highlight: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
