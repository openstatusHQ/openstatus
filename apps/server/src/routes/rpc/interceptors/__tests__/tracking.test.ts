// @ts-nocheck — ConnectRPC's deep generic types (AnyFn, UnaryResponse, etc.)
// are incompatible with bun:test mocks. All runtime behavior is correct.
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Interceptor } from "@connectrpc/connect";
import { Events } from "@openstatus/analytics";

import { RPC_CONTEXT_KEY } from "../auth";
import { RPC_EVENT_MAP, trackingInterceptor } from "../tracking";

// Mock analytics
const mockTrack = mock(() => Promise.resolve());
const mockSetupAnalytics = mock((_props: unknown) =>
  Promise.resolve({ track: mockTrack }),
);

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
  setupAnalytics: (props: unknown) => mockSetupAnalytics(props),
}));

type NextFn = Parameters<ReturnType<Interceptor>>[0];

/** Create a mock `next` that resolves with the given value. */
function mockNext(response: unknown): NextFn {
  return mock(() => Promise.resolve(response)) as unknown as NextFn;
}

/** Create a mock `next` that rejects with the given error. */
function mockNextReject(error: Error): NextFn {
  return mock(() => Promise.reject(error)) as unknown as NextFn;
}

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
      "DeleteMonitor",
    );
    const mockResponse = { id: "1" };
    const next = mockNext(mockResponse);

    const result = await interceptor(next)(req as never);

    expect(result).toEqual(mockResponse);
    expect(mockSetupAnalytics).toHaveBeenCalledTimes(1);
    expect(mockSetupAnalytics).toHaveBeenCalledWith({
      userId: "api_42",
      workspaceId: "42",
      plan: "free",
      location: "1.2.3.4",
      userAgent: "test-agent",
    });

    // Flush the .then() chain
    await Promise.resolve();

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
      "CreateHTTPMonitor",
      { url: "https://example.com", jobType: "http", name: "my-monitor" },
    );
    const next = mockNext({});

    await interceptor(next)(req as never);
    await Promise.resolve();

    expect(mockTrack).toHaveBeenCalledWith({
      ...Events.CreateMonitor,
      additionalProps: { url: "https://example.com", jobType: "http" },
    });
  });

  test("silently skips unmapped methods", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.health.v1.HealthService",
      "Check",
    );
    const mockResponse = { status: "ok" };
    const next = mockNext(mockResponse);

    const result = await interceptor(next)(req as never);

    expect(result).toEqual(mockResponse);
    expect(mockSetupAnalytics).not.toHaveBeenCalled();
  });

  test("does not track on error", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.monitor.v1.MonitorService",
      "DeleteMonitor",
    );
    const next = mockNextReject(new Error("not found"));

    expect(interceptor(next)(req as never)).rejects.toThrow("not found");
    expect(mockSetupAnalytics).not.toHaveBeenCalled();
  });

  test("skips tracking when no RPC context", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.monitor.v1.MonitorService",
      "DeleteMonitor",
      {},
      { withAuth: false },
    );
    const next = mockNext({});

    await interceptor(next)(req as never);

    expect(mockSetupAnalytics).not.toHaveBeenCalled();
  });

  test("still returns response when analytics fails", async () => {
    mockSetupAnalytics.mockImplementationOnce(() =>
      Promise.reject(new Error("analytics down")),
    );
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.monitor.v1.MonitorService",
      "DeleteMonitor",
    );
    const mockResponse = { id: "1" };
    const next = mockNext(mockResponse);

    const result = await interceptor(next)(req as never);

    expect(result).toEqual(mockResponse);

    // Flush the .catch() chain — should not throw
    await Promise.resolve();

    expect(mockTrack).not.toHaveBeenCalled();
  });

  test("passes correct workspace context", async () => {
    const interceptor = trackingInterceptor();
    const req = createMockRequest(
      "openstatus.notification.v1.NotificationService",
      "CreateNotification",
      { provider: "slack" },
    );
    const next = mockNext({});

    await interceptor(next)(req as never);

    expect(mockSetupAnalytics).toHaveBeenCalledWith({
      userId: "api_42",
      workspaceId: "42",
      plan: "free",
      location: "1.2.3.4",
      userAgent: "test-agent",
    });

    // Flush the .then() chain
    await Promise.resolve();

    expect(mockTrack).toHaveBeenCalledWith({
      ...Events.CreateNotification,
      additionalProps: { provider: "slack" },
    });
  });
});

describe("RPC_EVENT_MAP", () => {
  test("all mapped events reference valid Events entries", () => {
    const validEventNames = new Set(
      Object.values(Events).map((e) => e.name),
    ) as Set<string>;

    for (const [_key, mapping] of Object.entries(RPC_EVENT_MAP)) {
      expect(validEventNames.has(mapping.event.name)).toBe(true);
      expect(mapping.event.channel).toBeDefined();
    }
  });
});
