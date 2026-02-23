import { mock } from "bun:test";

const testRedisStore = new Map<string, string>();
(globalThis as Record<string, unknown>).__testRedisStore = testRedisStore;

mock.module("@openstatus/upstash", () => ({
  Redis: {
    fromEnv() {
      return {
        get: (key: string) => Promise.resolve(testRedisStore.get(key) ?? null),
        set: (key: string, value: string) => {
          testRedisStore.set(key, value);
          return Promise.resolve("OK");
        },
        del: (key: string) => {
          const existed = testRedisStore.has(key) ? 1 : 0;
          testRedisStore.delete(key);
          return Promise.resolve(existed);
        },
        getdel: (key: string) => {
          const value = testRedisStore.get(key) ?? null;
          testRedisStore.delete(key);
          return Promise.resolve(value);
        },
        expire: (_key: string, _seconds: number) => {
          return Promise.resolve(1);
        },
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
