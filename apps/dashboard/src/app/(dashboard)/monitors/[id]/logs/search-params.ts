import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsStringLiteral,
} from "nuqs/server";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { PERIODS, STATUS } from "@/data/metrics.client";

export const searchParamsParsers = {
  period: parseAsStringLiteral(PERIODS).withDefault("7d"),
  regions: parseAsArrayOf(parseAsStringLiteral(flyRegions)).withDefault(
    // FIXME: readonly
    flyRegions as unknown as (typeof flyRegions)[number][]
  ),
  status: parseAsStringLiteral(STATUS),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
