import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { app } from "@/index";
import { createErrorSchema } from "@/libs/errors";

import { MonitorSchema } from "./schema";

test("create a monitor persists OpenTelemetry for subsequent reads", async () => {
  const { workspace } = await createTestWorkspace();
  const headers = {
    "x-openstatus-key": String(workspace.id),
    "content-type": "application/json",
  };
  const openTelemetry = {
    endpoint: "https://otel.example.com/v1/traces",
    headers: { "x-api-key": "test-key", "x-tenant-id": "test-tenant" },
  };

  try {
    const res = await app.request("/v1/monitor", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Telemetry monitor",
        url: "https://example.com",
        method: "GET",
        periodicity: "10m",
        regions: ["ams"],
        openTelemetry,
      }),
    });
    expect(res.status).toBe(200);
    const created = MonitorSchema.parse(await res.json());
    const stored = await db
      .select()
      .from(monitor)
      .where(eq(monitor.workspaceId, workspace.id))
      .get();
    expect(stored?.otelEndpoint).toBe(openTelemetry.endpoint);
    expect(JSON.parse(stored?.otelHeaders ?? "null")).toEqual([
      { key: "x-api-key", value: "test-key" },
      { key: "x-tenant-id", value: "test-tenant" },
    ]);
    expect(created.openTelemetry).toEqual(openTelemetry);

    const read = await app.request(`/v1/monitor/${created.id}`, { headers });
    expect(read.status).toBe(200);
    expect(MonitorSchema.parse(await read.json()).openTelemetry).toEqual(
      openTelemetry,
    );
    const list = await app.request("/v1/monitor", { headers });
    expect(list.status).toBe(200);
    expect(MonitorSchema.array().parse(await list.json())).toEqual([created]);
  } finally {
    await db.delete(monitor).where(eq(monitor.workspaceId, workspace.id));
  }
});

for (const endpoint of [
  "http://127.0.0.1:4317",
  "ftp://otel.example.com",
  undefined,
]) {
  test(`create rejects unsafe OpenTelemetry endpoint ${endpoint ?? "(default)"}`, async () => {
    const { workspace } = await createTestWorkspace();
    try {
      const res = await app.request("/v1/monitor", {
        method: "POST",
        headers: {
          "x-openstatus-key": String(workspace.id),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Telemetry monitor",
          url: "example.com:443",
          jobType: "tcp",
          method: "GET",
          periodicity: "10m",
          regions: ["ams"],
          openTelemetry: { endpoint },
        }),
      });
      const stored = await db
        .select()
        .from(monitor)
        .where(eq(monitor.workspaceId, workspace.id));
      expect(stored).toEqual([]);
      expect(res.status).toBe(400);
    } finally {
      await db.delete(monitor).where(eq(monitor.workspaceId, workspace.id));
    }
  });
}

test("create a valid monitor", async () => {
  const res = await app.request("/v1/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      periodicity: "10m",
      url: "https://www.openstatus.dev",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      method: "POST",
      body: '{"hello":"world"}',
      headers: [{ key: "key", value: "value" }],
      active: true,
      public: true,
      assertions: [
        {
          type: "status",
          compare: "eq",
          target: 200,
        },
        { type: "header", compare: "not_eq", key: "key", target: "value" },
      ],
    }),
  });

  expect(res.status).toBe(200);
  const result = MonitorSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create a monitor with invalid payload should return 400", async () => {
  const res = await app.request("/v1/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      periodicity: 32, //not valid value
      url: "https://www.openstatus.dev",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      method: "POST",
      body: '{"hello":"world"}',
      headers: [{ key: "key", value: "value" }],
      active: true,
      public: false,
    }),
  });

  expect(res.status).toBe(400);
});

test("create a monitor with invalid page id should return 400", async () => {
  const res = await app.request("/v1/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitorIds: [1],
      pageId: 404,
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});

test("create a monitor with deprecated regions should return 400", async () => {
  const res = await app.request("/v1/monitor", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      regions: ["ams", "jnb", "hkg", "waw"],
      name: "Testing Deprecated Regions",
      description: "Testing Deprecated Regions",
      url: "https://www.openstatus.dev",
      method: "GET",
      active: true,
    }),
  });

  const json = await res.json();
  const errorSchema = createErrorSchema("BAD_REQUEST").safeParse(json);

  expect(res.status).toBe(400);
  expect(errorSchema.success).toBe(true);
  expect(errorSchema.data?.message).toContain(
    "Deprecated regions are not allowed: hkg, waw",
  );
});
