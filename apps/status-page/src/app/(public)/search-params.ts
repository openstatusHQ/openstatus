import { THEME_KEYS } from "@openstatus/theme-store";
import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

export const searchParamsParsers = {
  q: parseAsString,
  t: parseAsStringEnum(THEME_KEYS).withDefault("default"),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
