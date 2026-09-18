import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { app } from "@/index";

test("update the monitor", async () => {
  const res = await app.request("/v1/monitor/dns/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "New Name",
    }),
  });

  expect(res.status).toBe(400);
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/dns/404", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        uri: "openstatus.dev",
      },
      active: true,
      public: true,
    }),
  });

  expect(res.status).toBe(404);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/dns/2", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      /* */
    }),
  });

  expect(res.status).toBe(401);
});

for (const target of [
  { jobType: "dns", owned: true, status: 200 },
  { jobType: "http", owned: true, status: 404 },
  { jobType: "tcp", owned: true, status: 404 },
  { jobType: "dns", owned: false, status: 404 },
] as const) {
  test(`DNS update: ${target.owned ? "owned" : "foreign"} ${target.jobType} monitor returns ${target.status}`, async () => {
    const { workspace } = await createTestWorkspace();
    const owner = target.owned
      ? workspace
      : (await createTestWorkspace()).workspace;
    const original = await createMonitor(owner.id, {
      jobType: target.jobType,
      name: "Original monitor",
      url: "original.example.com",
    });

    const res = await app.request(`/v1/monitor/dns/${original.id}`, {
      method: "PUT",
      headers: {
        "x-openstatus-key": String(workspace.id),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        frequency: "10m",
        name: "Updated DNS monitor",
        regions: ["ams"],
        request: { uri: "updated.example.com" },
      }),
    });

    expect(res.status).toBe(target.status);
    const stored = await db
      .select()
      .from(monitor)
      .where(eq(monitor.id, original.id))
      .get();
    if (target.status === 200) {
      expect(await res.json()).toMatchObject({
        id: original.id,
        name: "Updated DNS monitor",
        url: "updated.example.com",
        jobType: "dns",
      });
      expect(stored).toMatchObject({
        name: "Updated DNS monitor",
        url: "updated.example.com",
        jobType: "dns",
        workspaceId: workspace.id,
      });
    } else {
      expect(stored).toEqual(original);
    }
  });
}
