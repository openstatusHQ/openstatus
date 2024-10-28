import type { HomeStatsParams } from "@openstatus/tinybird";
import { OSTinybird, Tinybird, getHomeStats } from "@openstatus/tinybird";

import { env } from "@/env";

// @depreciated in favor to use the OSTinybird client directly
const _tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

export async function getHomeStatsData(props: Partial<HomeStatsParams>) {
  try {
    const res = await getHomeStats(_tb)(props);
    return res.data;
  } catch (e) {
    console.error(e);
  }
  return;
}

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

// REMINDER: we could extend the limits (WorkspacePlan) by
// knowing which plan the user is on and disable some periods
const periods = ["1d", "7d", "14d"] as const;

// REMINDER: extend if needed
export function prepareListByPeriod(period: (typeof periods)[number]) {
  switch (period) {
    case "1d":
      return { getData: tb.httpListDaily };
    case "7d":
      return { getData: tb.httpListWeekly };
    case "14d":
      return { getData: tb.httpListBiweekly };
    default:
      return { getData: tb.httpListDaily };
  }
}

export function prepareMetricsByPeriod(period: (typeof periods)[number]) {
  switch (period) {
    case "1d":
      return { getData: tb.httpMetricsDaily };
    case "7d":
      return { getData: tb.httpMetricsWeekly };
    case "14d":
      return { getData: tb.httpMetricsBiweekly };
    default:
      return { getData: tb.httpMetricsDaily };
  }
}

export function prepareMetricByRegionByPeriod(
  period: (typeof periods)[number]
) {
  switch (period) {
    case "1d":
      return { getData: tb.httpMetricsByRegionDaily };
    case "7d":
      return { getData: tb.httpMetricsByRegionWeekly };
    case "14d":
      return { getData: tb.httpMetricsByRegionBiweekly };
    default:
      return { getData: tb.httpMetricsByRegionDaily };
  }
}

export function prepareMetricByIntervalByPeriod(
  period: (typeof periods)[number]
) {
  switch (period) {
    case "1d":
      return { getData: tb.httpMetricsByIntervalDaily };
    case "7d":
      return { getData: tb.httpMetricsByIntervalWeekly };
    case "14d":
      return { getData: tb.httpMetricsByIntervalBiweekly };
    default:
      return { getData: tb.httpMetricsByIntervalDaily };
  }
}

export function prepareStatusByPeriod(period: "7d" | "45d") {
  switch (period) {
    case "7d":
      return { getData: tb.httpStatusWeekly };
    case "45d":
      return { getData: tb.httpStatus45d };
    default:
      return { getData: tb.httpStatusWeekly };
  }
}

export function prepareGetByPeriod(period: "30d") {
  switch (period) {
    case "30d":
      return { getData: tb.httpGetMonthly };
    default:
      return { getData: tb.httpGetMonthly };
  }
}
