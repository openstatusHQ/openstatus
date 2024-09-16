import { flyRegions } from "@openstatus/db/src/schema/constants";
import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const searchParamsParsers = {
  monitorId: parseAsString.withDefault(""),
  url: parseAsString.withDefault(""),
  region: parseAsStringLiteral(flyRegions).withDefault("ams"),
  cronTimestamp: parseAsInteger.withDefault(0),
};
export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
