import { mock } from "bun:test";
// Import the real module BEFORE mock.module runs so we can spread real
// service functions (createSubscription, updateChannel, etc.) into the
// replacement while still stubbing the dispatch-side spies.
import * as realSubscriptions from "@openstatus/subscriptions";

// Subscription dispatch spies — accessible in tests via globalThis.__subscriptionSpies
const dispatchStatusReportUpdateSpy = mock((_id: number) => Promise.resolve());
const dispatchMaintenanceUpdateSpy = mock((_id: number) => Promise.resolve());

const sendVerificationSpy = mock(
  (_subscription: realSubscriptions.Subscription, _verifyUrl: string) =>
    Promise.resolve(),
);

const getChannelMock = {
  id: "email",
  sendVerification: sendVerificationSpy,
  sendNotifications: mock(() => Promise.resolve()),
  validateConfig: mock(() => Promise.resolve({ valid: true })),
};

(globalThis as Record<string, unknown>).__subscriptionSpies = {
  dispatchStatusReportUpdate: dispatchStatusReportUpdateSpy,
  dispatchMaintenanceUpdate: dispatchMaintenanceUpdateSpy,
  sendVerification: sendVerificationSpy,
  getChannel: getChannelMock,
};

mock.module("@openstatus/subscriptions", () => ({
  ...realSubscriptions,
  dispatchStatusReportUpdate: dispatchStatusReportUpdateSpy,
  dispatchMaintenanceUpdate: dispatchMaintenanceUpdateSpy,
  getChannel: () => getChannelMock,
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

const tinybirdMockData = {
  httpListBiweekly: [] as unknown[],
  httpGetBiweekly: [] as unknown[],
};
const tinybirdMockCalls = {
  httpListBiweekly: [] as unknown[],
  httpGetBiweekly: [] as unknown[],
};

(globalThis as Record<string, unknown>).__tinybirdMockData = tinybirdMockData;
(globalThis as Record<string, unknown>).__tinybirdMockCalls = tinybirdMockCalls;

const emptyTinybirdResponse = () => Promise.resolve({ data: [] });

const tbMock = {
  get legacy_httpStatus45d() {
    return emptyTinybirdResponse;
  },
  get legacy_tcpStatus45d() {
    return emptyTinybirdResponse;
  },
  get httpListBiweekly() {
    return (params: unknown) => {
      tinybirdMockCalls.httpListBiweekly.push(params);
      return Promise.resolve({ data: tinybirdMockData.httpListBiweekly });
    };
  },
  get httpGetBiweekly() {
    return (params: unknown) => {
      tinybirdMockCalls.httpGetBiweekly.push(params);
      return Promise.resolve({ data: tinybirdMockData.httpGetBiweekly });
    };
  },
  get httpMetricsDaily() {
    return emptyTinybirdResponse;
  },
  get httpMetricsWeekly() {
    return emptyTinybirdResponse;
  },
  get httpMetricsBiweekly() {
    return emptyTinybirdResponse;
  },
  get tcpMetricsDaily() {
    return emptyTinybirdResponse;
  },
  get tcpMetricsWeekly() {
    return emptyTinybirdResponse;
  },
  get tcpMetricsBiweekly() {
    return emptyTinybirdResponse;
  },
  get dnsMetricsDaily() {
    return emptyTinybirdResponse;
  },
  get dnsMetricsWeekly() {
    return emptyTinybirdResponse;
  },
  get dnsMetricsBiweekly() {
    return emptyTinybirdResponse;
  },
};

mock.module("@/libs/clients", () => ({
  tb: tbMock,
  redis: {
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
    expire: (_key: string, _seconds: number) => Promise.resolve(1),
  },
}));

mock.module("@openstatus/tinybird", () => ({
  OSTinybird: class {
    get legacy_httpStatus45d() {
      return tbMock.legacy_httpStatus45d;
    }
    get legacy_tcpStatus45d() {
      return tbMock.legacy_tcpStatus45d;
    }
    get httpListBiweekly() {
      return tbMock.httpListBiweekly;
    }
    get httpGetBiweekly() {
      return tbMock.httpGetBiweekly;
    }
    // HTTP metrics for GetMonitorSummary
    get httpMetricsDaily() {
      return tbMock.httpMetricsDaily;
    }
    get httpMetricsWeekly() {
      return tbMock.httpMetricsWeekly;
    }
    get httpMetricsBiweekly() {
      return tbMock.httpMetricsBiweekly;
    }
    // TCP metrics for GetMonitorSummary
    get tcpMetricsDaily() {
      return tbMock.tcpMetricsDaily;
    }
    get tcpMetricsWeekly() {
      return tbMock.tcpMetricsWeekly;
    }
    get tcpMetricsBiweekly() {
      return tbMock.tcpMetricsBiweekly;
    }
    // DNS metrics for GetMonitorSummary
    get dnsMetricsDaily() {
      return tbMock.dnsMetricsDaily;
    }
    get dnsMetricsWeekly() {
      return tbMock.dnsMetricsWeekly;
    }
    get dnsMetricsBiweekly() {
      return tbMock.dnsMetricsBiweekly;
    }
  },
}));
