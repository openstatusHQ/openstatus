import { OSTinybird } from "@openstatus/tinybird";

import { env } from "../env";

export const tb = new OSTinybird({
  token: env.TINY_BIRD_API_KEY,
  baseUrl: env.TINYBIRD_URL,
  noop: env.TINYBIRD_NOOP,
});

// REMINDER: we could extend the limits (WorkspacePlan) by
// knowing which plan the user is on and disable some periods
const periods = ["1d", "7d", "14d"] as const;
const types = ["http", "tcp", "icmp"] as const;

// FIXME: check we we can also use Period from elswhere
type Period = (typeof periods)[number];
// FIMXE: use JobType instead!
type Type = (typeof types)[number];

// REMINDER: extend if needed
export function prepareListByPeriod(period: Period, type: Type = "http") {
  switch (period) {
    case "1d": {
      const getData = {
        http: tb.legacy_httpListDaily,
        tcp: tb.legacy_tcpListDaily,
        icmp: tb.icmpListDaily,
      } as const;
      return { getData: getData[type] };
    }
    case "7d": {
      const getData = {
        http: tb.legacy_httpListWeekly,
        tcp: tb.legacy_tcpListWeekly,
        icmp: tb.icmpListWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "14d": {
      const getData = {
        http: tb.legacy_httpListBiweekly,
        tcp: tb.legacy_tcpListBiweekly,
        icmp: tb.icmpListBiweekly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.legacy_httpListDaily,
        tcp: tb.legacy_tcpListDaily,
        icmp: tb.icmpListDaily,
      } as const;
      return { getData: getData[type] };
    }
  }
}

export function prepareMetricsByPeriod(period: Period, type: Type = "http") {
  switch (period) {
    case "1d": {
      const getData = {
        http: tb.legacy_httpMetricsDaily,
        tcp: tb.legacy_tcpMetricsDaily,
        icmp: tb.icmpMetricsDaily,
      } as const;
      return { getData: getData[type] };
    }
    case "7d": {
      const getData = {
        http: tb.legacy_httpMetricsWeekly,
        tcp: tb.legacy_tcpMetricsWeekly,
        icmp: tb.icmpMetricsWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "14d": {
      const getData = {
        http: tb.legacy_httpMetricsBiweekly,
        tcp: tb.legacy_tcpMetricsBiweekly,
        icmp: tb.icmpMetricsBiweekly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.legacy_httpMetricsDaily,
        tcp: tb.legacy_tcpMetricsDaily,
        icmp: tb.icmpMetricsDaily,
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
        icmp: tb.icmpMetricsByRegionDaily,
      } as const;
      return { getData: getData[type] };
    }
    case "7d": {
      const getData = {
        http: tb.httpMetricsByRegionWeekly,
        tcp: tb.tcpMetricsByRegionWeekly,
        icmp: tb.icmpMetricsByRegionWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "14d": {
      const getData = {
        http: tb.httpMetricsByRegionBiweekly,
        tcp: tb.tcpMetricsByRegionBiweekly,
        icmp: tb.icmpMetricsByRegionBiweekly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpMetricsByRegionDaily,
        tcp: tb.tcpMetricsByRegionDaily,
        icmp: tb.icmpMetricsByRegionDaily,
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
        icmp: tb.icmpMetricsByIntervalDaily,
      } as const;
      return { getData: getData[type] };
    }
    case "7d": {
      const getData = {
        http: tb.httpMetricsByIntervalWeekly,
        tcp: tb.tcpMetricsByIntervalWeekly,
        icmp: tb.icmpMetricsByIntervalWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "14d": {
      const getData = {
        http: tb.httpMetricsByIntervalBiweekly,
        tcp: tb.tcpMetricsByIntervalBiweekly,
        icmp: tb.icmpMetricsByIntervalBiweekly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpMetricsByIntervalDaily,
        tcp: tb.tcpMetricsByIntervalDaily,
        icmp: tb.icmpMetricsByIntervalDaily,
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
        icmp: tb.icmpStatusWeekly,
      } as const;
      return { getData: getData[type] };
    }
    case "45d": {
      const getData = {
        http: tb.legacy_httpStatus45d,
        tcp: tb.legacy_tcpStatus45d,
        icmp: tb.icmpStatus45d,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpStatusWeekly,
        tcp: tb.tcpStatusWeekly,
        icmp: tb.icmpStatusWeekly,
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
        icmp: tb.icmpGetMonthly,
      } as const;
      return { getData: getData[type] };
    }
    default: {
      const getData = {
        http: tb.httpGetMonthly,
        tcp: tb.tcpGetMonthly,
        icmp: tb.icmpGetMonthly,
      } as const;
      return { getData: getData[type] };
    }
  }
}

// FOR MIGRATION
export type ResponseTimeMetrics = Awaited<
  ReturnType<OSTinybird["legacy_httpMetricsDaily"]>
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
