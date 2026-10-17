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

for (const { name, input, expected } of [
  {
    name: "clears stored assertions when the update supplies an empty list",
    input: { assertions: [] },
    expected: [],
  },
  {
    name: "keeps stored assertions when the update omits them",
    input: { name: "Renamed monitor" },
    expected: [{ type: "status", compare: "eq", target: 201 }],
  },
  {
    name: "replaces stored assertions when the update supplies a nonempty list",
    input: { assertions: [{ type: "status", compare: "eq", target: 204 }] },
    expected: [{ type: "status", compare: "eq", target: 204 }],
  },
  {
    name: "persists DNS record assertions instead of clearing stored assertions",
    input: {
      assertions: [
        { type: "dnsRecord", key: "A", compare: "eq", target: "192.0.2.1" },
      ],
    },
    expected: [
      { type: "dnsRecord", key: "A", compare: "eq", target: "192.0.2.1" },
    ],
  },
]) {
  test(name, async () => {
    const { workspace } = await createTestWorkspace();
    const created = await createMonitor(workspace.id, {
      jobType: "http",
      periodicity: "10m",
      assertions:
        '[{"version":"v1","type":"status","compare":"eq","target":201}]',
    });
    const headers = {
      "x-openstatus-key": String(workspace.id),
      "content-type": "application/json",
    };
    const path = `/v1/monitor/${created.id}`;
    const updated = await app.request(path, {
      method: "PUT",
      headers,
      body: JSON.stringify(input),
    });
    expect(updated.status).toBe(200);
    expect(MonitorSchema.parse(await updated.json()).assertions).toEqual(
      expected,
    );

    const stored = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, created.id))
      .get();
    expect(JSON.parse(stored?.assertions ?? "null")).toEqual(
      expected.map((assertion) => ({ ...assertion, version: "v1" })),
    );

    const readback = await app.request(path, { headers });
    expect(readback.status).toBe(200);
    expect(MonitorSchema.parse(await readback.json()).assertions).toEqual(
      expected,
    );
  });
}
