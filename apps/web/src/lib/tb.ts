import { OSTinybird } from "@openstatus/tinybird";

import { env } from "@/env";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

// REMINDER: we could extend the limits (WorkspacePlan) by
// knowing which plan the user is on and disable some periods
const periods = ["1d", "7d", "14d"] as const;
const types = ["http", "tcp"] as const;

// FIXME: check we we can also use Period from elswhere
type Period = (typeof periods)[number];
// FIMXE: use JobType instead!
type Type = (typeof types)[number];

// REMINDER: extend if needed
export function prepareListByPeriod(period: Period, type: Type = "http") {
  switch (period) {
    case "1d": {
      const getData = {
        http: tb.httpListDaily,
        tcp: tb.tcpListDaily,
      } as const;
      return { getData: getData[type] };
    }
    case "7d": {
      const getData = {
        http: tb.httpListWeekly,
        tcp: tb.tcpListWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "14d": {
      const getData = {
        http: tb.httpListBiweekly,
        tcp: tb.tcpListBiweekly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpListDaily,
        tcp: tb.tcpListDaily,
      } as const;
      return { getData: getData[type] };
    }
  }
}

export function prepareMetricsByPeriod(period: Period, type: Type = "http") {
  switch (period) {
    case "1d": {
      const getData = {
        http: tb.httpMetricsDaily,
        tcp: tb.tcpMetricsDaily,
      } as const;
      return { getData: getData[type] };
    }
    case "7d": {
      const getData = {
        http: tb.httpMetricsWeekly,
        tcp: tb.tcpMetricsWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "14d": {
      const getData = {
        http: tb.httpMetricsBiweekly,
        tcp: tb.tcpMetricsBiweekly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpMetricsDaily,
        tcp: tb.tcpMetricsDaily,
      } as const;
      return { getData: getData[type] };
    }
  }
}

export function prepareMetricByRegionByPeriod(
  period: Period,
  type: Type = "http",
) {
  switch (period) {
    case "1d": {
      const getData = {
        http: tb.httpMetricsByRegionDaily,
        tcp: tb.tcpMetricsByRegionDaily,
      } as const;
      return { getData: getData[type] };
    }
    case "7d": {
      const getData = {
        http: tb.httpMetricsByRegionWeekly,
        tcp: tb.tcpMetricsByRegionWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "14d": {
      const getData = {
        http: tb.httpMetricsByRegionBiweekly,
        tcp: tb.tcpMetricsByRegionBiweekly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpMetricsByRegionDaily,
        tcp: tb.tcpMetricsByRegionDaily,
      } as const;
      return { getData: getData[type] };
    }
  }
}

export function prepareMetricByIntervalByPeriod(
  period: Period,
  type: Type = "http",
) {
  switch (period) {
    case "1d": {
      const getData = {
        http: tb.httpMetricsByIntervalDaily,
        tcp: tb.tcpMetricsByIntervalDaily,
      } as const;
      return { getData: getData[type] };
    }
    case "7d": {
      const getData = {
        http: tb.httpMetricsByIntervalWeekly,
        tcp: tb.tcpMetricsByIntervalWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "14d": {
      const getData = {
        http: tb.httpMetricsByIntervalBiweekly,
        tcp: tb.tcpMetricsByIntervalBiweekly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpMetricsByIntervalDaily,
        tcp: tb.tcpMetricsByIntervalDaily,
      } as const;
      return { getData: getData[type] };
    }
  }
}

export function prepareStatusByPeriod(
  period: "7d" | "45d",
  type: Type = "http",
) {
  switch (period) {
    case "7d": {
      const getData = {
        http: tb.httpStatusWeekly,
        tcp: tb.tcpStatusWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "45d": {
      const getData = {
        http: tb.httpStatus45d,
        tcp: tb.tcpStatus45d,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpStatusWeekly,
        tcp: tb.tcpStatusWeekly,
      } as const;
      return { getData: getData[type] };
    }
  }
}

export function prepareGetByPeriod(period: "30d", type: Type = "http") {
  switch (period) {
    case "30d": {
      const getData = {
        http: tb.httpGetMonthly,
        tcp: tb.tcpGetMonthly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpGetMonthly,
        tcp: tb.tcpGetMonthly,
      } as const;
      return { getData: getData[type] };
    }
  }
}

// FOR MIGRATION
export type ResponseTimeMetrics = Awaited<
  ReturnType<OSTinybird["httpMetricsDaily"]>
>["data"][number];

export type ResponseTimeMetricsByRegion = Awaited<
  ReturnType<OSTinybird["httpMetricsByRegionDaily"]>
>["data"][number];

export type ResponseGraph = Awaited<
  ReturnType<OSTinybird["httpMetricsByIntervalDaily"]>
>["data"][number];

export type ResponseStatusTracker = Awaited<
  ReturnType<OSTinybird["httpStatusWeekly"]>
>["data"][number];
