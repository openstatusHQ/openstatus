import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterAll, beforeAll, test } from "@std/testing/bdd";

import { app } from "@/index";

let workspaceId: number;

beforeAll(async () => {
  const fixture = await createTestWorkspace();
  workspaceId = fixture.workspace.id;
});

afterAll(async () => {
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId));
});

for (const jobType of ["http", "tcp"] as const) {
  test(`name-only ${jobType} update preserves omitted configuration`, async () => {
    const before = await createMonitor(workspaceId, {
      jobType,
      url: jobType === "http" ? "https://example.com" : "example.com:443",
      name: "Before",
      externalName: "Public name",
      description: "Keep this description",
      periodicity: "10m",
      method: "POST",
      active: true,
      public: true,
      regions: "ams,iad",
      timeout: 1234,
      retry: 5,
      body: "request body",
      followRedirects: false,
      degradedAfter: 1000,
      headers: '[{"key":"x-custom","value":"keep"}]',
      assertions:
        '[{"version":"v1","type":"status","compare":"eq","target":201}]',
      otelEndpoint: "https://otel.example.com",
      otelHeaders: '[{"key":"x-otel","value":"keep"}]',
    });
    const res = await app.request(`/v1/monitor/${before.id}`, {
      method: "PUT",
      headers: {
        "x-openstatus-key": String(workspaceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "After" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "After", jobType });
    const after = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, before.id))
      .get();
    expect(after).toEqual({
      ...before,
      name: "After",
      updatedAt: after?.updatedAt,
    });
  });
}

test("explicit false, zero and supplied settings are persisted", async () => {
  const before = await createMonitor(workspaceId, {
    active: true,
    public: true,
    followRedirects: true,
    timeout: 1234,
    retry: 5,
    degradedAfter: 1000,
    periodicity: "10m",
    regions: "ams",
    body: "old body",
  });
  const res = await app.request(`/v1/monitor/${before.id}`, {
    method: "PUT",
    headers: {
      "x-openstatus-key": String(workspaceId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      active: false,
      public: false,
      followRedirects: false,
      timeout: 0,
      retry: 0,
      degradedAfter: 0,
      regions: ["iad"],
      body: "new body",
      description: "New description",
      method: "POST",
      headers: [{ key: "x-custom", value: "new" }],
    }),
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    active: false,
    public: false,
    followRedirects: false,
    timeout: 0,
    retry: 0,
  });
  const saved = await db
    .select()
    .from(monitor)
    .where(eq(monitor.id, before.id))
    .get();
  expect(saved).toMatchObject({
    active: false,
    public: false,
    followRedirects: false,
    timeout: 0,
    retry: 0,
    degradedAfter: 0,
    regions: "iad",
    body: "new body",
    description: "New description",
    method: "POST",
    headers: '[{"key":"x-custom","value":"new"}]',
    periodicity: "10m",
  });
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/-1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": String(workspaceId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  expect(res.status).toBe(404);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/2", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  expect(res.status).toBe(401);
});
