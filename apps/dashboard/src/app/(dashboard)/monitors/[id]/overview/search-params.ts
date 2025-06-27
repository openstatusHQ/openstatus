import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsStringLiteral,
} from "nuqs/server";
import { flyRegions } from "@openstatus/db/src/schema/constants";

const PERIOD = ["1d", "7d", "14d"] as const;

export const searchParamsParsers = {
  period: parseAsStringLiteral(PERIOD).withDefault("7d"),
  regions: parseAsArrayOf(parseAsStringLiteral(flyRegions)).withDefault(
    // FIXME: readonly
    flyRegions as unknown as (typeof flyRegions)[number][]
  ),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
