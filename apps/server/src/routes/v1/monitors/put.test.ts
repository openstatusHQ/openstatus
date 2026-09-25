import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { app } from "@/index";

import { MonitorSchema } from "./schema";

test("update a monitor replaces OpenTelemetry and preserves it when omitted", async () => {
  const { workspace } = await createTestWorkspace();
  const existing = await createMonitor(workspace.id, {
    otelEndpoint: "https://old.example.com/v1/traces",
    otelHeaders: '[{"key":"x-old","value":"old-value"}]',
  });
  const headers = {
    "x-openstatus-key": String(workspace.id),
    "content-type": "application/json",
  };
  const endpoint = "https://otel.example.com/v1/traces";

  try {
    for (const step of [
      {
        body: {
          openTelemetry: { endpoint, headers: { "x-api-key": "new-key" } },
        },
        expected: { endpoint, headers: { "x-api-key": "new-key" } },
        storedHeaders: [{ key: "x-api-key", value: "new-key" }],
      },
      {
        body: { name: "Renamed monitor" },
        expected: { endpoint, headers: { "x-api-key": "new-key" } },
        storedHeaders: [{ key: "x-api-key", value: "new-key" }],
      },
      {
        body: { openTelemetry: { endpoint, headers: {} } },
        expected: { endpoint, headers: {} },
        storedHeaders: [],
      },
    ]) {
      const res = await app.request(`/v1/monitor/${existing.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(step.body),
      });
      expect(res.status).toBe(200);
      const updated = MonitorSchema.parse(await res.json());
      const stored = await db
        .select()
        .from(monitor)
        .where(eq(monitor.id, existing.id))
        .get();
      expect(stored?.otelEndpoint).toBe(endpoint);
      expect(JSON.parse(stored?.otelHeaders ?? "null")).toEqual(
        step.storedHeaders,
      );
      expect(updated.openTelemetry).toEqual(step.expected);

      const read = await app.request(`/v1/monitor/${existing.id}`, { headers });
      expect(read.status).toBe(200);
      expect(MonitorSchema.parse(await read.json()).openTelemetry).toEqual(
        step.expected,
      );
    }
  } finally {
    await db.delete(monitor).where(eq(monitor.workspaceId, workspace.id));
  }
});

for (const endpoint of [
  "http://127.0.0.1:4317",
  "ftp://otel.example.com",
  undefined,
]) {
  test(`update rejects unsafe OpenTelemetry endpoint ${endpoint ?? "(default)"}`, async () => {
    const { workspace } = await createTestWorkspace();
    const existing = await createMonitor(workspace.id, {
      jobType: "tcp",
      url: "example.com:443",
      otelEndpoint: "https://otel.example.com",
      otelHeaders: '[{"key":"x-api-key","value":"existing-key"}]',
    });
    try {
      const res = await app.request(`/v1/monitor/${existing.id}`, {
        method: "PUT",
        headers: {
          "x-openstatus-key": String(workspace.id),
          "content-type": "application/json",
        },
        body: JSON.stringify({ jobType: "tcp", openTelemetry: { endpoint } }),
      });
      const stored = await db
        .select()
        .from(monitor)
        .where(eq(monitor.id, existing.id))
        .get();
      expect(stored).toEqual(existing);
      expect(res.status).toBe(400);
    } finally {
      await db.delete(monitor).where(eq(monitor.workspaceId, workspace.id));
    }
  });
}

test("update the monitor", async () => {
  const res = await app.request("/v1/monitor/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "New Name",
    }),
  });
  const data = await res.json();
  const monitor = MonitorSchema.parse(data);
  expect(res.status).toBe(200);
  expect(monitor.name).toBe("New Name");
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/404", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({/* */}),
  });

  expect(res.status).toBe(404);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/2", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({/* */}),
  });

  expect(res.status).toBe(401);
});
