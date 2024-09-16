import { flyRegions } from "@openstatus/db/src/schema/constants";
import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const searchParamsParsers = {
  regions: parseAsArrayOf(parseAsStringLiteral(flyRegions)),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
