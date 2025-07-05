import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { PERIODS, STATUS, TRIGGER } from "@/data/metrics.client";

export const searchParamsParsers = {
  period: parseAsStringLiteral(PERIODS).withDefault("1d"),
  regions: parseAsArrayOf(parseAsStringLiteral(flyRegions)).withDefault(
    // FIXME: readonly
    flyRegions as unknown as (typeof flyRegions)[number][]
  ),
  status: parseAsStringLiteral(STATUS),
  trigger: parseAsStringLiteral(TRIGGER),
  selected: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
