import { monitorRegions } from "@openstatus/db/src/schema/constants";
import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const searchParamsParsers = {
  monitorId: parseAsString.withDefault(""),
  url: parseAsString.withDefault(""),
  region: parseAsStringLiteral(monitorRegions).withDefault("ams"),
  cronTimestamp: parseAsInteger.withDefault(0),
};
export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
