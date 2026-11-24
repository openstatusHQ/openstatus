import { db, eq } from "@openstatus/db";
import { oauthClient, oauthGrant, type Scope } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createNotification,
  createPage,
  createPageComponent,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { app } from "../../index";

// Free plan caps these suites sit at: 1 monitor, 3 page components (across
// the workspace), 1 notification channel, periodicity 10m and up.

type Headers = Record<string, string>;

const keyFor = (workspaceId: number): Headers => ({
  "x-openstatus-key": String(workspaceId),
});

function rpc(service: string, method: string, body: object, headers: Headers) {
  return app.request(`/rpc/${service}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const monitorRpc = (method: string, body: object, headers: Headers) =>
  rpc("openstatus.monitor.v1.MonitorService", method, body, headers);
const statusPageRpc = (method: string, body: object, headers: Headers) =>
  rpc("openstatus.status_page.v1.StatusPageService", method, body, headers);
const notificationRpc = (method: string, body: object, headers: Headers) =>
  rpc("openstatus.notification.v1.NotificationService", method, body, headers);

const freeWorkspace = async () =>
  (await createTestWorkspace({ plan: "free" })).workspace.id;

const CREATE_BODIES: Record<string, (periodicity: string) => object> = {
  CreateHTTPMonitor: (periodicity) => ({
    monitor: {
      name: "plan-limit-http",
      url: "https://plan-limit.example.com",
      method: "HTTP_METHOD_GET",
      periodicity,
    },
  }),
  CreateTCPMonitor: (periodicity) => ({
    monitor: {
      name: "plan-limit-tcp",
      uri: "tcp://plan-limit.example.com:8080",
      periodicity,
    },
  }),
  CreateDNSMonitor: (periodicity) => ({
    monitor: {
      name: "plan-limit-dns",
      uri: "plan-limit.example.com",
      periodicity,
    },
  }),
  CreateICMPMonitor: (periodicity) => ({
    monitor: { name: "plan-limit-icmp", uri: "8.8.8.8", periodicity },
  }),
  CreateGRPCMonitor: (periodicity) => ({
    monitor: {
      name: "plan-limit-grpc",
      uri: "api.example.com:443",
      periodicity,
      service: "checkout.v1.CheckoutService",
    },
  }),
  // Heartbeats have a period instead of a periodicity.
  CreateHeartbeatMonitor: () => ({
    monitor: { name: "plan-limit-heartbeat", period: "3600", grace: "300" },
  }),
};

describe("monitor cap", () => {
  let atCapWorkspaceId: number;

  beforeAll(async () => {
    atCapWorkspaceId = await freeWorkspace();
    await createMonitor(atCapWorkspaceId);
  });

  test.each(Object.keys(CREATE_BODIES))(
    "%s at the cap answers 403 Upgrade for more monitors",
    async (method) => {
      const res = await monitorRpc(
        method,
        CREATE_BODIES[method]("PERIODICITY_10M"),
        keyFor(atCapWorkspaceId),
      );
      expect(res.status).toBe(403);
      expect((await res.json()).message).toContain("Upgrade for more monitors");
    },
  );

  test("a soft-deleted monitor does not count against the cap", async () => {
    const workspaceId = await freeWorkspace();
    await createMonitor(workspaceId, { deletedAt: new Date() });
    const res = await monitorRpc(
      "CreateHTTPMonitor",
      CREATE_BODIES.CreateHTTPMonitor("PERIODICITY_10M"),
      keyFor(workspaceId),
    );
    expect(res.status).toBe(200);
  });

  test("a heartbeat counts against the cap like any other monitor", async () => {
    const workspaceId = await freeWorkspace();
    const first = await monitorRpc(
      "CreateHeartbeatMonitor",
      CREATE_BODIES.CreateHeartbeatMonitor(""),
      keyFor(workspaceId),
    );
    expect(first.status).toBe(200);

    const second = await monitorRpc(
      "CreateHTTPMonitor",
      CREATE_BODIES.CreateHTTPMonitor("PERIODICITY_10M"),
      keyFor(workspaceId),
    );
    expect(second.status).toBe(403);
  });

  test("the first monitor is created and the second is refused", async () => {
    const workspaceId = await freeWorkspace();
    const body = CREATE_BODIES.CreateHTTPMonitor("PERIODICITY_10M");

    const first = await monitorRpc(
      "CreateHTTPMonitor",
      body,
      keyFor(workspaceId),
    );
    expect(first.status).toBe(200);

    const second = await monitorRpc(
      "CreateHTTPMonitor",
      body,
      keyFor(workspaceId),
    );
    expect(second.status).toBe(403);
  });

  test("a periodicity outside the plan is reported before the cap", async () => {
    const res = await monitorRpc(
      "CreateHTTPMonitor",
      CREATE_BODIES.CreateHTTPMonitor("PERIODICITY_1M"),
      keyFor(atCapWorkspaceId),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain("periodicity");
  });
});

describe("page component cap", () => {
  test("counts components on every page of the workspace", async () => {
    const workspaceId = await freeWorkspace();
    const full = await createPage(workspaceId);
    for (let i = 0; i < 3; i++) {
      await createPageComponent(workspaceId, full.id, { order: i });
    }
    // The second page is empty: a per-page count would let this through.
    const empty = await createPage(workspaceId);

    const res = await statusPageRpc(
      "AddStaticComponent",
      { pageId: String(empty.id), name: "plan-limit-static" },
      keyFor(workspaceId),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain(
      "Upgrade for more page components",
    );
  });

  test("allows a component below the cap", async () => {
    const workspaceId = await freeWorkspace();
    const page = await createPage(workspaceId);
    await createPageComponent(workspaceId, page.id);

    const res = await statusPageRpc(
      "AddStaticComponent",
      { pageId: String(page.id), name: "plan-limit-static-ok" },
      keyFor(workspaceId),
    );
    expect(res.status).toBe(200);
  });

  test("AddMonitorComponent hits the same cap", async () => {
    const workspaceId = await freeWorkspace();
    const page = await createPage(workspaceId);
    const monitor = await createMonitor(workspaceId);
    for (let i = 0; i < 3; i++) {
      await createPageComponent(workspaceId, page.id, { order: i });
    }

    const res = await statusPageRpc(
      "AddMonitorComponent",
      { pageId: String(page.id), monitorId: String(monitor.id) },
      keyFor(workspaceId),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain(
      "Upgrade for more page components",
    );
  });
});

describe("status page cap", () => {
  test("a second page on the free plan answers 403", async () => {
    const workspaceId = await freeWorkspace();
    await createPage(workspaceId);

    const res = await statusPageRpc(
      "CreateStatusPage",
      {
        title: "plan-limit-page",
        slug: `plan-limit-page-${workspaceId}`,
      },
      keyFor(workspaceId),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).message).toContain(
      "Upgrade for more status pages",
    );
  });
});

describe("CheckNotificationLimit", () => {
  let workspaceId: number;
  let userId: number;
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

  async function tokenWith(scope: Scope[]): Promise<Headers> {
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

  beforeAll(async () => {
    const fixture = await createTestWorkspace({ plan: "free" });
    workspaceId = fixture.workspace.id;
    userId = fixture.user.id;
    clientId = `rpc-plan-limits-${workspaceId}`;
    await db.insert(oauthClient).values({
      clientId,
      redirectUris: ["http://localhost/callback"],
    });
  });

  afterAll(async () => {
    await db.delete(oauthClient).where(eq(oauthClient.clientId, clientId));
  });

  test("reports usage below and at the cap", async () => {
    const empty = await notificationRpc(
      "CheckNotificationLimit",
      {},
      keyFor(workspaceId),
    );
    expect(empty.status).toBe(200);
    // Proto3 JSON omits zero and false.
    expect(await empty.json()).toEqual({ maxCount: 1 });

    await createNotification(workspaceId);

    const full = await notificationRpc(
      "CheckNotificationLimit",
      {},
      keyFor(workspaceId),
    );
    expect(await full.json()).toEqual({
      currentCount: 1,
      maxCount: 1,
      limitReached: true,
    });
  });

  test("a notifications:read token may read it", async () => {
    const res = await notificationRpc(
      "CheckNotificationLimit",
      {},
      await tokenWith(["notifications:read"]),
    );
    expect(res.status).toBe(200);
  });

  test("a token without a notifications scope is refused", async () => {
    const res = await notificationRpc(
      "CheckNotificationLimit",
      {},
      await tokenWith(["monitors:read"]),
    );
    expect(res.status).toBe(403);
  });
});
