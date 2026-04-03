import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Events } from "@openstatus/analytics";

import { RPC_CONTEXT_KEY } from "../auth";
import { RPC_EVENT_MAP, trackingInterceptor } from "../tracking";

// Mock analytics
const mockTrack = mock(() => Promise.resolve());
const mockSetupAnalytics = mock(() => Promise.resolve({ track: mockTrack }));

mock.module("@openstatus/analytics", () => ({
  Events,
  parseInputToProps: (json: unknown, props?: string[]) => {
    if (typeof json !== "object" || json === null || !props) return {};
    return props.reduce(
      (acc, prop) => {
        if (prop in json) {
          acc[prop] = (json as Record<string, unknown>)[prop];
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  },
  setupAnalytics: (...args: unknown[]) => mockSetupAnalytics(...args),
}));

const TEST_WORKSPACE = {
  id: 42,
  slug: "test-ws",
  plan: "free" as const,
  stripeId: null,
  name: "",
  createdAt: new Date(),
  updatedAt: new Date(),
  endsAt: null,
  paidUntil: null,
  subscriptionId: null,
  dsn: "",
};

function createMockRequest(
  serviceTypeName: string,
  methodName: string,
  message: Record<string, unknown> = {},
  opts?: { withAuth?: boolean },
) {
  const contextValues = new Map<unknown, unknown>();

  if (opts?.withAuth !== false) {
    contextValues.set(RPC_CONTEXT_KEY, {
      workspace: TEST_WORKSPACE,
      requestId: "test-req-id",
    });
  }

  return {
    service: { typeName: serviceTypeName },
    method: { name: methodName },
    message,
    header: new Headers({
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "test-agent",
    }),
    contextValues: {
      get: (key: unknown) => contextValues.get(key),
      set: (key: unknown, value: unknown) => contextValues.set(key, value),
    },
  } as unknown;
}

describe("trackingInterceptor", () => {
  beforeEach(() => {
    mockSetupAnalytics.mockClear();
    mockTrack.mockClear();
  });

  test("tracks mapped event on success", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.monitor.v1.MonitorService",
      "deleteMonitor",
    );
    const mockResponse = { id: "1" };
    const next = mock(() => Promise.resolve(mockResponse));

    const result = await interceptor(next)(req as never);

    expect(result).toBe(mockResponse);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockSetupAnalytics).toHaveBeenCalledTimes(1);
    expect(mockSetupAnalytics).toHaveBeenCalledWith({
      userId: "api_42",
      workspaceId: "42",
      plan: "free",
      location: "1.2.3.4",
      userAgent: "test-agent",
    });

    // Wait for the async track call
    await new Promise((r) => setTimeout(r, 10));

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith({
      ...Events.DeleteMonitor,
      additionalProps: {},
    });
  });

  test("extracts additional props from message", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.monitor.v1.MonitorService",
      "createHTTPMonitor",
      { url: "https://example.com", jobType: "http", name: "my-monitor" },
    );
    const next = mock(() => Promise.resolve({}));

    await interceptor(next)(req as never);
    await new Promise((r) => setTimeout(r, 10));

    expect(mockTrack).toHaveBeenCalledWith({
      ...Events.CreateMonitor,
      additionalProps: { url: "https://example.com", jobType: "http" },
    });
  });

  test("silently skips unmapped methods", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.health.v1.HealthService",
      "check",
    );
    const mockResponse = { status: "ok" };
    const next = mock(() => Promise.resolve(mockResponse));

    const result = await interceptor(next)(req as never);

    expect(result).toBe(mockResponse);
    expect(mockSetupAnalytics).not.toHaveBeenCalled();
  });

  test("does not track on error", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.monitor.v1.MonitorService",
      "deleteMonitor",
    );
    const next = mock(() => Promise.reject(new Error("not found")));

    await expect(interceptor(next)(req as never)).rejects.toThrow("not found");
    expect(mockSetupAnalytics).not.toHaveBeenCalled();
  });

  test("skips tracking when no RPC context", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.monitor.v1.MonitorService",
      "deleteMonitor",
      {},
      { withAuth: false },
    );
    const next = mock(() => Promise.resolve({}));

    await interceptor(next)(req as never);

    expect(mockSetupAnalytics).not.toHaveBeenCalled();
  });

  test("passes correct workspace context", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.notification.v1.NotificationService",
      "createNotification",
      { provider: "slack" },
    );
    const next = mock(() => Promise.resolve({}));

    await interceptor(next)(req as never);

    expect(mockSetupAnalytics).toHaveBeenCalledWith({
      userId: "api_42",
      workspaceId: "42",
      plan: "free",
      location: "1.2.3.4",
      userAgent: "test-agent",
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(mockTrack).toHaveBeenCalledWith({
      ...Events.CreateNotification,
      additionalProps: { provider: "slack" },
    });
  });
});

describe("RPC_EVENT_MAP", () => {
  test("all mapped events reference valid Events entries", () => {
    const validEventNames = new Set(Object.values(Events).map((e) => e.name));

    for (const [_key, mapping] of Object.entries(RPC_EVENT_MAP)) {
      expect(validEventNames.has(mapping.event.name)).toBe(true);
      expect(mapping.event.channel).toBeDefined();
    }
  });
});
