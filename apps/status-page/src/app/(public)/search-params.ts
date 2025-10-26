import { THEME_KEYS } from "@openstatus/theme-store";
import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

export const searchParamsParsers = {
  q: parseAsString, // q = query
  t: parseAsStringEnum(THEME_KEYS).withDefault("default"), // t = theme
  b: parseAsBoolean.withDefault(false), // b = builder
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
