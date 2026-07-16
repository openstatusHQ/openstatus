// Shared test-double state, set on globalThis so tests can assert on spies and
// configure mock data — same interface the old bun `mock.module` preload
// exposed. Imported (for side effect) by every double module below.
import { mock } from "@openstatus/test-utils";

type Mut = Record<string, unknown>;
const g = globalThis as Mut;

if (!g.__subscriptionSpies) {
  const sendVerification = mock(() => Promise.resolve());
  g.__subscriptionSpies = {
    dispatchStatusReportUpdate: mock(() => Promise.resolve()),
    dispatchMaintenanceUpdate: mock(() => Promise.resolve()),
    sendVerification,
    getChannel: {
      id: "email",
      sendVerification,
      sendNotifications: mock(() => Promise.resolve()),
      validateConfig: mock(() => Promise.resolve({ valid: true })),
    },
  };
}

if (!g.__testRedisStore) {
  g.__testRedisStore = new Map<string, string>();
}

if (!g.__tinybirdMockData) {
  g.__tinybirdMockData = { httpListBiweekly: [], httpGetBiweekly: [] };
}
if (!g.__tinybirdMockCalls) {
  g.__tinybirdMockCalls = { httpListBiweekly: [], httpGetBiweekly: [] };
}

export const subscriptionSpies = g.__subscriptionSpies as {
  dispatchStatusReportUpdate: ReturnType<typeof mock>;
  dispatchMaintenanceUpdate: ReturnType<typeof mock>;
  sendVerification: ReturnType<typeof mock>;
  getChannel: Record<string, unknown>;
};
export const testRedisStore = g.__testRedisStore as Map<string, string>;
export const tinybirdMockData = g.__tinybirdMockData as {
  httpListBiweekly: unknown[];
  httpGetBiweekly: unknown[];
};
export const tinybirdMockCalls = g.__tinybirdMockCalls as {
  httpListBiweekly: unknown[];
  httpGetBiweekly: unknown[];
};
