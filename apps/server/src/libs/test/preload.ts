import { mock } from "bun:test";

mock.module("@openstatus/upstash", () => ({
  Redis: {
    fromEnv() {
      return {
        get: () => Promise.resolve(undefined),
        set: () => Promise.resolve([]),
      };
    },
  },
}));

mock.module("@openstatus/tinybird", () => ({
  OSTinybird: class {
    get legacy_httpStatus45d() {
      return () => Promise.resolve({ data: [] });
    }
    get legacy_tcpStatus45d() {
      return () => Promise.resolve({ data: [] });
    }
    // HTTP metrics for GetMonitorSummary
    get httpMetricsDaily() {
      return () => Promise.resolve({ data: [] });
    }
    get httpMetricsWeekly() {
      return () => Promise.resolve({ data: [] });
    }
    get httpMetricsBiweekly() {
      return () => Promise.resolve({ data: [] });
    }
    // TCP metrics for GetMonitorSummary
    get tcpMetricsDaily() {
      return () => Promise.resolve({ data: [] });
    }
    get tcpMetricsWeekly() {
      return () => Promise.resolve({ data: [] });
    }
    get tcpMetricsBiweekly() {
      return () => Promise.resolve({ data: [] });
    }
    // DNS metrics for GetMonitorSummary
    get dnsMetricsDaily() {
      return () => Promise.resolve({ data: [] });
    }
    get dnsMetricsWeekly() {
      return () => Promise.resolve({ data: [] });
    }
    get dnsMetricsBiweekly() {
      return () => Promise.resolve({ data: [] });
    }
  },
}));
