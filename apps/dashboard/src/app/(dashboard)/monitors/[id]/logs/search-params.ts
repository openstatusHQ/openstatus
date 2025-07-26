import { PERIODS, STATUS, TRIGGER } from "@/data/metrics.client";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { endOfDay } from "date-fns";
import { startOfDay } from "date-fns";
import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsInteger,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const searchParamsParsers = {
  period: parseAsStringLiteral(PERIODS).withDefault("1d"),
  regions: parseAsArrayOf(parseAsStringLiteral(flyRegions)).withDefault(
    // FIXME: readonly
    flyRegions as unknown as (typeof flyRegions)[number][],
  ),
  status: parseAsStringLiteral(STATUS),
  trigger: parseAsStringLiteral(TRIGGER),
  selected: parseAsString,
  from: parseAsIsoDateTime.withDefault(startOfDay(new Date())),
  to: parseAsIsoDateTime.withDefault(endOfDay(new Date())),
  pageIndex: parseAsInteger.withDefault(0),
  pageSize: parseAsInteger.withDefault(20),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
