import {
  createParser,
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsStringLiteral,
} from "nuqs/server";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { PERIODS, STATUS } from "@/data/metrics.client";

const parseAsSelected = createParser({
  parse(queryValue) {
    const [monitorId, cronTimestamp, region] = queryValue.split("-");
    if (!monitorId || !cronTimestamp || !region) return null;
    return {
      monitorId: Number(monitorId),
      cronTimestamp: Number(cronTimestamp),
      region,
    };
  },
  serialize(value) {
    return `${value.monitorId}-${value.cronTimestamp}-${value.region}`;
  },
});

export const searchParamsParsers = {
  period: parseAsStringLiteral(PERIODS).withDefault("7d"),
  regions: parseAsArrayOf(parseAsStringLiteral(flyRegions)).withDefault(
    // FIXME: readonly
    flyRegions as unknown as (typeof flyRegions)[number][]
  ),
  status: parseAsStringLiteral(STATUS),
  selected: parseAsSelected,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
