import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorHeartbeatState,
  workspace,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createWorkspace,
} from "@openstatus/db/src/test/factories";
import { recordHeartbeatPing } from "@openstatus/services/monitor";
import type { HeartbeatPingEvent } from "@openstatus/tinybird";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { app } from "../../index";
import { createHeartbeatRoute } from "./index";

const TOKEN = `hb-route-test-${crypto.randomUUID()}`;
const PAUSED_TOKEN = `hb-route-paused-${crypto.randomUUID()}`;
const NOW = new Date("2026-03-01T12:00:00.000Z");

let workspaceId: number;
let monitorId: number;
let published: HeartbeatPingEvent[];

const route = createHeartbeatRoute({
  record: recordHeartbeatPing,
  publish: (event) => published.push(event),
  now: () => NOW,
});

beforeAll(async () => {
  const ws = await createWorkspace();
  workspaceId = ws.id;
  const hb = await createMonitor(ws.id, {
    jobType: "heartbeat",
    url: "",
    periodicity: "other",
    active: true,
    heartbeatToken: TOKEN,
    heartbeatPeriod: 3_600,
    heartbeatGrace: 300,
  });
  monitorId = hb.id;
  await createMonitor(ws.id, {
    jobType: "heartbeat",
    url: "",
    periodicity: "other",
    active: false,
    heartbeatToken: PAUSED_TOKEN,
    heartbeatPeriod: 3_600,
    heartbeatGrace: 300,
  });
});

beforeEach(() => {
  published = [];
});

afterAll(async () => {
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId));
  await db.delete(workspace).where(eq(workspace.id, workspaceId));
});

async function readState() {
  return db
    .select()
    .from(monitorHeartbeatState)
    .where(eq(monitorHeartbeatState.monitorId, monitorId))
    .get();
}

describe("heartbeat route", () => {
  test("unknown token returns 404 and records nothing", async () => {
    const res = await route.request(`/hb-route-test-unknown-${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
    expect(published).toHaveLength(0);
  });

  test("malformed token returns 404", async () => {
    const res = await route.request("/short");
    expect(res.status).toBe(404);
  });

  test("a ping upserts the deadline and publishes the ping", async () => {
    const res = await route.request(`/${TOKEN}`, {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
        "user-agent": "curl/8.0",
        "fly-client-ip": "203.0.113.7",
      },
      body: "backup done",
    });

    expect(res.status).toBe(200);
    const state = await readState();
    expect(state?.lastPingAt?.getTime()).toBe(NOW.getTime());
    expect(state?.nextDueAt?.getTime()).toBe(NOW.getTime() + 3_900_000);

    expect(published).toHaveLength(1);
    const [event] = published;
    expect(event).toMatchObject({
      timestamp: NOW.getTime(),
      monitorId,
      workspaceId,
      ip: "203.0.113.7",
      method: "POST",
      userAgent: "curl/8.0",
      body: "backup done",
      bodyTruncated: 0,
    });
    expect(event?.headers).toContain("[redacted]");
    expect(event?.headers).not.toContain("secret");
  });

  test("a large body is cut and flagged", async () => {
    await route.request(`/${TOKEN}`, {
      method: "POST",
      body: "x".repeat(20_000),
    });
    expect(published[0]?.bodyTruncated).toBe(1);
    expect(published[0]?.body).toHaveLength(10 * 1024);
  });

  test("a paused heartbeat answers 200 without recording", async () => {
    const res = await route.request(`/${PAUSED_TOKEN}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK (paused)");
    expect(published).toHaveLength(0);
  });

  test("a failing publish still records the ping", async () => {
    const failing = createHeartbeatRoute({
      record: recordHeartbeatPing,
      publish: () => {
        throw new Error("tinybird down");
      },
      now: () => new Date(NOW.getTime() + 60_000),
    });

    const res = await failing.request(`/${TOKEN}`);

    expect(res.status).toBe(200);
    const state = await readState();
    expect(state?.lastPingAt?.getTime()).toBe(NOW.getTime() + 60_000);
  });

  test("is mounted on the app without auth", async () => {
    const res = await app.request(`/heartbeat/${TOKEN}`, { method: "HEAD" });
    expect(res.status).toBe(200);
  });
});
