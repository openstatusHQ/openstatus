import { flyRegions } from "@openstatus/db/src/schema/constants";
import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsStringLiteral,
} from "nuqs/server";

export const searchParamsParsers = {
  regions: parseAsArrayOf(parseAsStringLiteral(flyRegions)),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
