import { format } from "date-fns";

import { flyRegionsDict } from "@openstatus/utils";

import type { Period, Quantile } from "@/lib/monitor/utils";
import type { ResponseGraph } from "@/lib/tb";
import type { Region } from "@openstatus/db/src/schema/constants";

/**
 *
 * @param data expects to be sorted by cronTimestamp
 * @param period
 * @returns
 */
export function groupDataByTimestamp(
  data: ResponseGraph[],
  period: Period,
  quantile: Quantile,
) {
  let currentTimestamp = 0;
  const regions: Record<
    string,
    { code: string; location: string; flag: string }
  > = {};
  const _data = data.reduce(
    (acc, curr) => {
      const { timestamp, region } = curr;
      const latency = curr[`${quantile}Latency`];
      const { flag, code, location } = flyRegionsDict[region];
      const fullNameRegion = `${code}`;
      regions[fullNameRegion] = { flag, code, location }; // to get the region keys
      if (timestamp === currentTimestamp) {
        // overwrite last object in acc
        const last = acc.pop();
        if (last) {
          acc.push({
            ...last,
            [fullNameRegion]: latency,
          });
        }
      } else if (timestamp) {
        currentTimestamp = timestamp;
        // create new object in acc
        acc.push({
          timestamp: renderTimestamp(timestamp, period),
          [fullNameRegion]: latency,
        });
      }
      return acc;
    },
    [] as (Partial<Record<Region, number>> & { timestamp: string })[],
  );

  // regions are sorted by the flag utf-8 code
  return {
    regions: Object.keys(regions).sort() as Region[],
    data: _data.reverse(),
  };
}

/**
 * in case we need to change the format of the timestamp
 * based on the period
 * @param timestamp
 * @param period
 * @returns
 */
export function renderTimestamp(timestamp: number, _period: Period) {
  const date = new Date(timestamp);
  return date.toISOString();
}

export function dataFormatter(number: number) {
  return `${Intl.NumberFormat("us").format(number).toString()}ms`;
}

export function regionFormatter(region: Region) {
  const { code, flag } = flyRegionsDict[region];
  return `${flag} ${code}`;
}
