import { db, eq } from "@openstatus/db";
import { monitor, monitorHeartbeatState } from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

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
    expect(mon.pingUrl).toMatch(
      /^https:\/\/api\.openstatus\.dev\/heartbeat\/[\w-]{32}$/,
    );
    expect(mon.lastPingAt).toBeUndefined();

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

  test("is gated to allowlisted workspaces", async () => {
    const res = await connectRequest(
      "CreateHeartbeatMonitor",
      {
        monitor: { name: "rpc-heartbeat-gated", period: "3600", grace: "300" },
      },
      OTHER_KEY,
    );
    expect(res.status).toBe(403);
  });

  test("get and list return it with the last ping", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-get");
    const lastPingAt = new Date("2026-04-01T08:00:00.000Z");
    await db.insert(monitorHeartbeatState).values({
      monitorId: Number(mon.id),
      lastPingAt,
      nextDueAt: new Date(lastPingAt.getTime() + 3_900_000),
    });

    const get = await connectRequest("GetMonitor", { id: mon.id });
    expect(get.status).toBe(200);
    const getData = await get.json();
    expect(getData.monitor.heartbeat.lastPingAt).toBe(lastPingAt.toISOString());

    const list = await connectRequest("ListMonitors", { limit: 100 });
    const listData = await list.json();
    const ids = (listData.heartbeatMonitors ?? []).map(
      (m: { id: string }) => m.id,
    );
    expect(ids).toContain(mon.id);
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

  test("refuses to update a heartbeat through another type", async () => {
    const mon = await createHeartbeat("rpc-heartbeat-mismatch");
    const res = await connectRequest("UpdateHTTPMonitor", {
      id: mon.id,
      monitor: { name: "nope" },
    });
    expect(res.status).not.toBe(200);
  });
});
