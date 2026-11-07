import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorHeartbeatState,
  oauthClient,
  oauthGrant,
  type Scope,
  workspace,
} from "@openstatus/db/src/schema";
import { TEAM_WORKSPACE_LIMITS } from "@openstatus/db/src/seed/limits";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import type { HeartbeatPing } from "@openstatus/tinybird";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { heartbeatPingMock } from "@/libs/test/doubles/state";

import { app } from "../../../../../index";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

async function connectRequest(
  method: string,
  body: { [key: string]: Json },
  key = "1",
) {
  return app.request(`/rpc/openstatus.monitor.v1.MonitorService/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-openstatus-key": key },
    body: JSON.stringify(body),
  });
}

const created: number[] = [];
let OTHER_KEY: string;

beforeAll(async () => {
  OTHER_KEY = String(
    (await createTestWorkspace({ plan: "team" })).workspace.id,
  );
});

afterAll(async () => {
  for (const id of created) {
    await db.delete(monitor).where(eq(monitor.id, id));
  }
});

async function createHeartbeat(name: string) {
  const res = await connectRequest("CreateHeartbeatMonitor", {
    monitor: { name, period: "3600", grace: "300", active: true },
  });
  expect(res.status).toBe(200);
  const data = await res.json();
  created.push(Number(data.monitor.id));
  return data.monitor;
}

describe("MonitorService heartbeat", () => {
  test("creates a heartbeat with a ping url", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-create");

    expect(mon.period).toBe("3600");
    expect(mon.grace).toBe("300");
    expect(mon.pingUrl).toMatch(/^https?:\/\/[^/]+\/heartbeat\/[\w-]{32}$/);
    expect(mon.lastPingAt).toBeUndefined();
    expect(mon.lastPingKind).toBeUndefined();

    const row = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, Number(mon.id)))
      .get();
    expect(row?.jobType).toBe("heartbeat");
    expect(row?.periodicity).toBe("other");
  });

  test("rejects a period outside the bounds", async () => {
    const res = await connectRequest("CreateHeartbeatMonitor", {
      monitor: { name: "rpc-heartbeat-short", period: "30", grace: "300" },
    });
    expect(res.status).toBe(400);
  });

  test("is available to every workspace", async () => {
    const res = await connectRequest(
      "CreateHeartbeatMonitor",
      {
        monitor: { name: "rpc-heartbeat-other", period: "3600", grace: "300" },
      },
      OTHER_KEY,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    created.push(Number(data.monitor.id));
  });

  test("get and list return it with the last ping", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-get");
    const lastPingAt = new Date("2026-04-01T08:00:00.000Z");
    await db.insert(monitorHeartbeatState).values({
      monitorId: Number(mon.id),
      lastPingAt,
      lastPingKind: "fail",
      nextDueAt: new Date(lastPingAt.getTime() + 3_900_000),
    });

    const get = await connectRequest("GetMonitor", { id: mon.id });
    expect(get.status).toBe(200);
    const getData = await get.json();
    expect(getData.monitor.heartbeat.lastPingAt).toBe(lastPingAt.toISOString());
    expect(getData.monitor.heartbeat.lastPingKind).toBe(
      "HEARTBEAT_PING_KIND_FAIL",
    );

    const list = await connectRequest("ListMonitors", { limit: 100 });
    const listData = await list.json();
    const listed = (listData.heartbeatMonitors ?? []).find(
      (m: { id: string }) => m.id === mon.id,
    );
    expect(listed?.lastPingAt).toBe(lastPingAt.toISOString());
    expect(listed?.lastPingKind).toBe("HEARTBEAT_PING_KIND_FAIL");

    const nextDueAt = new Date(lastPingAt.getTime() + 3_900_000).toISOString();
    expect(getData.monitor.heartbeat.nextDueAt).toBe(nextDueAt);
    expect(listed?.nextDueAt).toBe(nextDueAt);
  });

  test("updates period and grace", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-update");
    const res = await connectRequest("UpdateHeartbeatMonitor", {
      id: mon.id,
      monitor: { period: "7200", grace: "600" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.monitor.period).toBe("7200");
    expect(data.monitor.grace).toBe("600");
  });

  test("rejects an update with a name over the bound", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-long-name");
    const res = await connectRequest("UpdateHeartbeatMonitor", {
      id: mon.id,
      monitor: { name: "x".repeat(257) },
    });
    expect(res.status).toBe(400);
  });

  test("refuses to update a heartbeat through another type", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-mismatch");
    const res = await connectRequest("UpdateHTTPMonitor", {
      id: mon.id,
      monitor: { name: "nope" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_argument");
    expect(body.message).toContain("Monitor type mismatch");
  });
});

type AuthHeaders = Record<string, string>;

async function rpc(
  method: string,
  body: { [key: string]: Json },
  headers: AuthHeaders,
) {
  return app.request(`/rpc/openstatus.monitor.v1.MonitorService/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function pingRow(overrides: Partial<HeartbeatPing> = {}): HeartbeatPing {
  return {
    id: "ping-1",
    timestamp: 1_767_225_600_000,
    monitorId: "0",
    ip: "203.0.113.7",
    method: "POST",
    userAgent: "curl/8.0",
    headers: JSON.stringify({ "x-job": "backup" }),
    body: "stack trace",
    bodyTruncated: 1,
    kind: "fail",
    ...overrides,
  };
}

function encodeCursor(timestamp: number) {
  return Buffer.from(`v1:${timestamp}`).toString("base64url");
}

describe("MonitorService heartbeat next_due_at", () => {
  test("is unset before the first ping", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-due-new");
    expect(mon.nextDueAt).toBeUndefined();

    const get = await connectRequest("GetMonitor", { id: mon.id });
    expect((await get.json()).monitor.heartbeat.nextDueAt).toBeUndefined();
  });

  test("stays set on a down heartbeat whose deadline passed", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-due-down");
    const nextDueAt = new Date("2026-01-01T00:00:00.000Z");
    await db.insert(monitorHeartbeatState).values({
      monitorId: Number(mon.id),
      lastPingAt: new Date("2025-12-31T22:55:00.000Z"),
      lastPingKind: "success",
      nextDueAt,
    });
    await db
      .update(monitor)
      .set({ status: "error" })
      .where(eq(monitor.id, Number(mon.id)));

    const get = await connectRequest("GetMonitor", { id: mon.id });
    expect((await get.json()).monitor.heartbeat.nextDueAt).toBe(
      nextDueAt.toISOString(),
    );
  });

  test("is hidden while paused and re-anchored on resume", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-due-pause");
    const stale = new Date(Date.now() - 86_400_000);
    await db.insert(monitorHeartbeatState).values({
      monitorId: Number(mon.id),
      lastPingAt: new Date(stale.getTime() - 3_900_000),
      lastPingKind: "success",
      nextDueAt: stale,
    });

    const paused = await connectRequest("UpdateHeartbeatMonitor", {
      id: mon.id,
      monitor: { active: false },
    });
    expect(paused.status).toBe(200);
    expect((await paused.json()).monitor.nextDueAt).toBeUndefined();

    const get = await connectRequest("GetMonitor", { id: mon.id });
    expect((await get.json()).monitor.heartbeat.nextDueAt).toBeUndefined();

    const resumed = await connectRequest("UpdateHeartbeatMonitor", {
      id: mon.id,
      monitor: { active: true },
    });
    expect(resumed.status).toBe(200);
    const due = Date.parse((await resumed.json()).monitor.nextDueAt);
    expect(due).toBeGreaterThan(Date.now());
  });
});

describe("MonitorService.ListMonitorHeartbeatPings", () => {
  beforeEach(() => {
    heartbeatPingMock.rows = [];
    heartbeatPingMock.calls = [];
  });

  test("returns the pings with every field", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-pings");
    heartbeatPingMock.rows = [
      pingRow(),
      pingRow({
        id: "ping-2",
        timestamp: 1_767_225_000_000,
        method: "GET",
        ip: null,
        userAgent: null,
        headers: null,
        body: null,
        bodyTruncated: 0,
        kind: "success",
      }),
    ];

    const res = await connectRequest("ListMonitorHeartbeatPings", {
      id: mon.id,
    });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.pings).toEqual([
      {
        id: "ping-1",
        monitorId: mon.id,
        timestamp: "1767225600000",
        kind: "HEARTBEAT_PING_KIND_FAIL",
        method: "POST",
        ip: "203.0.113.7",
        userAgent: "curl/8.0",
        headers: { "x-job": "backup" },
        body: "stack trace",
        bodyTruncated: true,
      },
      {
        id: "ping-2",
        monitorId: mon.id,
        timestamp: "1767225000000",
        kind: "HEARTBEAT_PING_KIND_SUCCESS",
        method: "GET",
      },
    ]);
    expect(data.nextCursor).toBeUndefined();
    expect(heartbeatPingMock.calls).toHaveLength(1);
    expect(heartbeatPingMock.calls[0]).toMatchObject({
      monitorId: mon.id,
      limit: 50,
      kinds: undefined,
      cursor: undefined,
    });
  });

  test("pages with an opaque cursor", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-pings-page");
    const last = Date.now() - 60_000;
    heartbeatPingMock.rows = [
      pingRow({ id: "a", timestamp: last + 1_000 }),
      pingRow({ id: "b", timestamp: last }),
    ];

    const first = await connectRequest("ListMonitorHeartbeatPings", {
      id: mon.id,
      limit: 2,
    });
    const firstData = await first.json();
    expect(firstData.nextCursor).toBe(encodeCursor(last));

    heartbeatPingMock.rows = [];
    const second = await connectRequest("ListMonitorHeartbeatPings", {
      id: mon.id,
      limit: 2,
      cursor: firstData.nextCursor,
    });
    expect(second.status).toBe(200);
    expect((await second.json()).nextCursor).toBeUndefined();
    expect(heartbeatPingMock.calls[1]?.cursor).toBe(last);
  });

  test("passes the window and kinds to Tinybird", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-pings-filter");
    const from = Date.now() - 3_600_000;
    const to = Date.now();

    const res = await connectRequest("ListMonitorHeartbeatPings", {
      id: mon.id,
      fromTimestamp: String(from),
      toTimestamp: String(to),
      kinds: ["HEARTBEAT_PING_KIND_FAIL"],
      limit: 10,
    });
    expect(res.status).toBe(200);
    expect(heartbeatPingMock.calls[0]).toMatchObject({
      monitorId: mon.id,
      fromDate: from,
      toDate: to,
      kinds: ["fail"],
      limit: 10,
    });
  });

  test("clamps from to the plan retention", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-pings-retention");
    const res = await connectRequest("ListMonitorHeartbeatPings", {
      id: mon.id,
      fromTimestamp: "0",
    });
    expect(res.status).toBe(200);
    expect(heartbeatPingMock.calls[0]?.fromDate).toBeGreaterThan(0);
  });

  test.each([
    ["an unspecified kind", { kinds: ["HEARTBEAT_PING_KIND_UNSPECIFIED"] }],
    [
      "too many kinds",
      {
        kinds: [
          "HEARTBEAT_PING_KIND_FAIL",
          "HEARTBEAT_PING_KIND_SUCCESS",
          "HEARTBEAT_PING_KIND_FAIL",
        ],
      },
    ],
    ["a limit over 100", { limit: 101 }],
  ])("rejects %s", async (_, extra) => {
    const mon = await createHeartbeat("rpc-heartbeat-pings-invalid");
    const res = await connectRequest("ListMonitorHeartbeatPings", {
      id: mon.id,
      ...extra,
    });
    expect(res.status).toBe(400);
    expect(heartbeatPingMock.calls).toEqual([]);
  });

  test("rejects a cursor it did not issue", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-pings-cursor");
    const res = await connectRequest("ListMonitorHeartbeatPings", {
      id: mon.id,
      cursor: "1767225600000",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_argument");
    expect(body.message).toContain("Invalid cursor");
    expect(heartbeatPingMock.calls).toEqual([]);
  });

  test("returns not found for another workspace's heartbeat", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-pings-foreign");
    const res = await connectRequest(
      "ListMonitorHeartbeatPings",
      { id: mon.id },
      OTHER_KEY,
    );
    expect(res.status).toBe(404);
  });

  test("rejects an HTTP monitor", async () => {
    const http = await db
      .insert(monitor)
      .values({
        workspaceId: 1,
        name: "rpc-heartbeat-pings-http",
        url: "https://example.com",
        periodicity: "1m",
        regions: "ams",
        jobType: "http",
      })
      .returning()
      .get();
    created.push(http.id);

    const res = await connectRequest("ListMonitorHeartbeatPings", {
      id: String(http.id),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain(
      "expected heartbeat, got http",
    );
  });

  test("requires the response logs entitlement", async () => {
    const free = await createTestWorkspace({ plan: "free" });
    const key = String(free.workspace.id);
    const res = await connectRequest(
      "CreateHeartbeatMonitor",
      {
        monitor: {
          name: "rpc-heartbeat-pings-free",
          period: "3600",
          grace: "300",
        },
      },
      key,
    );
    const mon = (await res.json()).monitor;
    created.push(Number(mon.id));

    const list = await connectRequest(
      "ListMonitorHeartbeatPings",
      { id: mon.id },
      key,
    );
    expect(list.status).toBe(403);
    expect(heartbeatPingMock.calls).toEqual([]);
  });

  test("points heartbeat monitors away from the HTTP log endpoint", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-http-logs");
    const res = await connectRequest("ListMonitorHTTPResponseLogs", {
      id: mon.id,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain(
      "Use ListMonitorHeartbeatPings",
    );
  });
});

describe("MonitorService.RegenerateHeartbeatToken", () => {
  test("replaces the ping url and retires the old one", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-regen");
    const res = await connectRequest("RegenerateHeartbeatToken", {
      id: mon.id,
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()).monitor;

    expect(updated.id).toBe(mon.id);
    expect(updated.pingUrl).toMatch(/\/heartbeat\/[\w-]{32}$/);
    expect(updated.pingUrl).not.toBe(mon.pingUrl);

    const tokenOf = (url: string) => url.split("/heartbeat/")[1];
    const old = await app.request(`/heartbeat/${tokenOf(mon.pingUrl)}`);
    expect(old.status).toBe(404);
    const fresh = await app.request(`/heartbeat/${tokenOf(updated.pingUrl)}`);
    expect(fresh.status).toBe(200);
  });

  test("returns not found for another workspace's heartbeat", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-regen-foreign");
    const res = await connectRequest(
      "RegenerateHeartbeatToken",
      { id: mon.id },
      OTHER_KEY,
    );
    expect(res.status).toBe(404);
  });

  test("rejects a non-heartbeat monitor", async () => {
    const http = await db
      .insert(monitor)
      .values({
        workspaceId: 1,
        name: "rpc-heartbeat-regen-http",
        url: "https://example.com",
        periodicity: "1m",
        regions: "ams",
        jobType: "http",
      })
      .returning()
      .get();
    created.push(http.id);

    const res = await connectRequest("RegenerateHeartbeatToken", {
      id: String(http.id),
    });
    expect(res.status).toBe(400);
  });
});

describe("MonitorService heartbeat scopes", () => {
  let workspaceId: number;
  let clientId: string;

  async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(input),
    );
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function tokenWith(
    scope: Scope[],
    userId: number,
  ): Promise<AuthHeaders> {
    const token = `os_oat_${crypto.randomUUID().replaceAll("-", "")}`;
    const later = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(oauthGrant).values({
      clientId,
      userId,
      workspaceId,
      scope,
      accessTokenHash: await sha256Hex(token),
      accessTokenExpiresAt: later,
      refreshTokenHash: await sha256Hex(`${token}-refresh`),
      refreshTokenExpiresAt: later,
    });
    return { Authorization: `Bearer ${token}` };
  }

  let readKey: AuthHeaders;
  let writeKey: AuthHeaders;
  let monitorId: string;

  beforeAll(async () => {
    const fixture = await createTestWorkspace({ plan: "team" });
    workspaceId = fixture.workspace.id;
    await db
      .update(workspace)
      .set({
        limits: JSON.stringify({
          ...JSON.parse(TEAM_WORKSPACE_LIMITS),
          "response-logs": true,
        }),
      })
      .where(eq(workspace.id, workspaceId));

    clientId = `rpc-heartbeat-scopes-${workspaceId}`;
    await db.insert(oauthClient).values({
      clientId,
      redirectUris: ["http://localhost/callback"],
    });
    readKey = await tokenWith(["monitors:read"], fixture.user.id);
    writeKey = await tokenWith(["monitors:write"], fixture.user.id);

    const res = await rpc(
      "CreateHeartbeatMonitor",
      {
        monitor: { name: "rpc-heartbeat-scoped", period: "3600", grace: "300" },
      },
      writeKey,
    );
    monitorId = (await res.json()).monitor.id;
    created.push(Number(monitorId));
  });

  afterAll(async () => {
    await db.delete(oauthClient).where(eq(oauthClient.clientId, clientId));
  });

  test("a read key lists pings", async () => {
    const res = await rpc(
      "ListMonitorHeartbeatPings",
      { id: monitorId },
      readKey,
    );
    expect(res.status).toBe(200);
  });

  test("a read key cannot regenerate the token", async () => {
    const res = await rpc(
      "RegenerateHeartbeatToken",
      { id: monitorId },
      readKey,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain("monitors:write");
  });

  test("a write key regenerates the token", async () => {
    const res = await rpc(
      "RegenerateHeartbeatToken",
      { id: monitorId },
      writeKey,
    );
    expect(res.status).toBe(200);
  });
});
