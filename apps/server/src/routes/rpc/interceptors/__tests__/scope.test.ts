// @ts-nocheck — ConnectRPC's deep generic request types are incompatible
// with the hand-built mocks. All runtime behavior is correct.
import { MethodOptions_IdempotencyLevel } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import type { Scope } from "@openstatus/db/src/schema";
import { describe, expect, test, vi } from "vitest";

import { RPC_CONTEXT_KEY } from "../auth";
import { requiredScopeFor, scopeInterceptor } from "../scope";

const MONITOR = "openstatus.monitor.v1.MonitorService";
const PAGE = "openstatus.status_page.v1.StatusPageService";
const REPORT = "openstatus.status_report.v1.StatusReportService";
const INCIDENT = "openstatus.incident.v1.IncidentService";
const MAINTENANCE = "openstatus.maintenance.v1.MaintenanceService";
const NOTIFICATION = "openstatus.notification.v1.NotificationService";
const PRIVATE_LOCATION =
  "openstatus.private_location.v1.PrivateLocationService";
const HEALTH = "openstatus.health.v1.HealthService";

const NO_SIDE_EFFECTS = MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS;
const UNKNOWN = MethodOptions_IdempotencyLevel.IDEMPOTENCY_UNKNOWN;

function createMockRequest(
  serviceTypeName: string,
  methodName: string,
  opts: { scopes?: Scope[]; idempotency?: MethodOptions_IdempotencyLevel } = {},
) {
  const contextValues = new Map<unknown, unknown>();
  if (opts.scopes !== undefined) {
    contextValues.set(RPC_CONTEXT_KEY, {
      workspace: { id: 42 },
      requestId: "test-req-id",
      apiKey: { id: "k", scopes: opts.scopes },
    });
  }
  return {
    service: { typeName: serviceTypeName },
    method: {
      name: methodName,
      idempotency: opts.idempotency ?? UNKNOWN,
    },
    contextValues: {
      get: <T>(key: { id: symbol; defaultValue: T }): T =>
        (contextValues.get(key) as T | undefined) ?? key.defaultValue,
    },
  };
}

async function run(
  serviceTypeName: string,
  methodName: string,
  opts: { scopes?: Scope[]; idempotency?: MethodOptions_IdempotencyLevel } = {},
) {
  const next = vi.fn(() => Promise.resolve({ message: {} }));
  const req = createMockRequest(serviceTypeName, methodName, opts);
  const result = scopeInterceptor()(next)(req);
  return { next, result };
}

async function expectDenied(
  promise: Promise<unknown>,
  code: Code,
  message?: RegExp,
) {
  await expect(promise).rejects.toBeInstanceOf(ConnectError);
  const err = await promise.catch((e) => e as ConnectError);
  expect(err.code).toBe(code);
  if (message) expect(err.rawMessage).toMatch(message);
}

describe("requiredScopeFor", () => {
  test("maps every service to its group", () => {
    expect(requiredScopeFor(MONITOR, { name: "CreateHTTPMonitor" })).toBe(
      "monitors:write",
    );
    expect(
      requiredScopeFor(PRIVATE_LOCATION, { name: "CreatePrivateLocation" }),
    ).toBe("monitors:write");
    expect(requiredScopeFor(PAGE, { name: "CreateStatusPage" })).toBe(
      "pages:write",
    );
    expect(requiredScopeFor(REPORT, { name: "CreateStatusReport" })).toBe(
      "incidents:write",
    );
    expect(requiredScopeFor(INCIDENT, { name: "DeclareIncident" })).toBe(
      "incidents:write",
    );
    expect(requiredScopeFor(MAINTENANCE, { name: "CreateMaintenance" })).toBe(
      "incidents:write",
    );
    expect(requiredScopeFor(NOTIFICATION, { name: "CreateNotification" })).toBe(
      "notifications:write",
    );
  });

  test("Get*/List* and NO_SIDE_EFFECTS methods are reads", () => {
    expect(requiredScopeFor(MONITOR, { name: "GetMonitor" })).toBe(
      "monitors:read",
    );
    expect(requiredScopeFor(MONITOR, { name: "ListMonitors" })).toBe(
      "monitors:read",
    );
    expect(
      requiredScopeFor(NOTIFICATION, {
        name: "CheckNotificationLimit",
        idempotency: NO_SIDE_EFFECTS,
      }),
    ).toBe("notifications:read");
    expect(
      requiredScopeFor(NOTIFICATION, { name: "CheckNotificationLimit" }),
    ).toBe("notifications:write");
    expect(requiredScopeFor(MONITOR, { name: "TriggerMonitor" })).toBe(
      "monitors:write",
    );
  });

  test("subscriber methods on StatusPageService belong to subscribers", () => {
    expect(requiredScopeFor(PAGE, { name: "ListSubscribers" })).toBe(
      "subscribers:read",
    );
    expect(requiredScopeFor(PAGE, { name: "SubscribeToPage" })).toBe(
      "subscribers:write",
    );
    expect(requiredScopeFor(PAGE, { name: "CreatePageSubscription" })).toBe(
      "subscribers:write",
    );
    expect(requiredScopeFor(PAGE, { name: "UnsubscribeFromPage" })).toBe(
      "subscribers:write",
    );
  });

  test("unmapped services need nothing", () => {
    expect(requiredScopeFor(HEALTH, { name: "Check" })).toBeNull();
  });
});

describe("scopeInterceptor", () => {
  test("skips HealthService without an auth context", async () => {
    const { next, result } = await run(HEALTH, "Check");
    await expect(result).resolves.toBeDefined();
    expect(next).toHaveBeenCalledOnce();
  });

  test("fails closed when a mapped service has no auth context", async () => {
    const { next, result } = await run(MONITOR, "ListMonitors");
    await expectDenied(result, Code.Unauthenticated);
    expect(next).not.toHaveBeenCalled();
  });

  test("read key reads monitors, cannot create one", async () => {
    const ok = await run(MONITOR, "GetMonitor", { scopes: ["read"] });
    await expect(ok.result).resolves.toBeDefined();

    const denied = await run(MONITOR, "CreateHTTPMonitor", {
      scopes: ["read"],
    });
    await expectDenied(denied.result, Code.PermissionDenied, /monitors:write/);
    expect(denied.next).not.toHaveBeenCalled();
  });

  test("other-group write key is denied", async () => {
    const { result } = await run(MONITOR, "CreateHTTPMonitor", {
      scopes: ["pages:write"],
    });
    await expectDenied(result, Code.PermissionDenied, /monitors:write/);
  });

  test("group read key cannot read another group", async () => {
    const { result } = await run(REPORT, "ListStatusReports", {
      scopes: ["monitors:read"],
      idempotency: NO_SIDE_EFFECTS,
    });
    await expectDenied(result, Code.PermissionDenied, /incidents:read/);
  });

  test("incidents:write covers reports, incidents and maintenances", async () => {
    for (const [service, method] of [
      [REPORT, "CreateStatusReport"],
      [INCIDENT, "DeclareIncident"],
      [MAINTENANCE, "ListMaintenances"],
    ] as const) {
      const { result } = await run(service, method, {
        scopes: ["incidents:write"],
      });
      await expect(result).resolves.toBeDefined();
    }
  });

  test("pages:read cannot list subscribers; read, write and subscribers:read can", async () => {
    const denied = await run(PAGE, "ListSubscribers", {
      scopes: ["pages:read"],
      idempotency: NO_SIDE_EFFECTS,
    });
    await expectDenied(
      denied.result,
      Code.PermissionDenied,
      /subscribers:read/,
    );

    for (const scopes of [
      ["read"],
      ["write"],
      ["subscribers:read"],
      ["*"],
    ] as Scope[][]) {
      const { result } = await run(PAGE, "ListSubscribers", {
        scopes,
        idempotency: NO_SIDE_EFFECTS,
      });
      await expect(result).resolves.toBeDefined();
    }
  });

  test("pages:write does not reach subscriber methods", async () => {
    const { result } = await run(PAGE, "CreatePageSubscription", {
      scopes: ["pages:write"],
    });
    await expectDenied(result, Code.PermissionDenied, /subscribers:write/);
  });

  test("empty scopes fail closed", async () => {
    const { result } = await run(MONITOR, "ListMonitors", { scopes: [] });
    await expectDenied(result, Code.PermissionDenied);
  });
});
