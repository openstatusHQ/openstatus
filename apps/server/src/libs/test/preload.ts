import { mock } from "bun:test";
// Import the real module BEFORE mock.module runs so we can spread real
// service functions (createSubscription, updateChannel, etc.) into the
// replacement while still stubbing the dispatch-side spies.
import * as realSubscriptions from "@openstatus/subscriptions";

// Subscription dispatch spies — accessible in tests via globalThis.__subscriptionSpies
const dispatchStatusReportUpdateSpy = mock((_id: number) => Promise.resolve());
const dispatchMaintenanceUpdateSpy = mock((_id: number) => Promise.resolve());

(globalThis as Record<string, unknown>).__subscriptionSpies = {
  dispatchStatusReportUpdate: dispatchStatusReportUpdateSpy,
  dispatchMaintenanceUpdate: dispatchMaintenanceUpdateSpy,
};

mock.module("@openstatus/subscriptions", () => ({
  ...realSubscriptions,
  dispatchStatusReportUpdate: dispatchStatusReportUpdateSpy,
  dispatchMaintenanceUpdate: dispatchMaintenanceUpdateSpy,
}));

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
