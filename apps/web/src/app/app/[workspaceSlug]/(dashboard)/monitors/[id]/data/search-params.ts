import { periods, triggers } from "@/lib/monitor/utils";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsStringLiteral,
} from "nuqs/server";

export const DEFAULT_PERIOD = "1d";

export const searchParamsParsers = {
  statusCode: parseAsArrayOf(parseAsInteger),
  cronTimestamp: parseAsInteger,
  error: parseAsArrayOf(parseAsBoolean),
  period: parseAsStringLiteral(periods).withDefault(DEFAULT_PERIOD),
  regions: parseAsArrayOf(parseAsStringLiteral(flyRegions)),
  pageSize: parseAsInteger.withDefault(10),
  pageIndex: parseAsInteger.withDefault(0),
  trigger: parseAsArrayOf(parseAsStringLiteral(triggers)),
};
export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
