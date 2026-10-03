import { deserialize } from "@openstatus/assertions";
import { and, db, eq } from "@openstatus/db";
import { monitor, selectMonitorSchema } from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { app } from "@/index";
import { getCheckerPayload } from "@/libs/checker/utils";

import { MonitorSchema } from "./schema";

for (const { name, assertions, expected } of [
  {
    name: "preserves DNS record assertions for reads and checks",
    assertions: [
      {
        kind: "dnsRecord",
        recordType: "A",
        compare: "eq",
        target: "192.0.2.1",
      },
      {
        kind: "dnsRecord",
        recordType: "CNAME",
        compare: "contains",
        target: "example.com",
      },
    ],
    expected: [
      { type: "dnsRecord", key: "A", compare: "eq", target: "192.0.2.1" },
      {
        type: "dnsRecord",
        key: "CNAME",
        compare: "contains",
        target: "example.com",
      },
    ],
  },
  {
    name: "accepts omitted DNS assertions",
    assertions: undefined,
    expected: null,
  },
  { name: "accepts empty DNS assertions", assertions: [], expected: null },
]) {
  test(name, async () => {
    const { workspace } = await createTestWorkspace();
    const headers = {
      "x-openstatus-key": String(workspace.id),
      "content-type": "application/json",
    };

    try {
      const res = await app.request("/v1/monitor/dns", {
        method: "POST",
        headers,
        body: JSON.stringify({
          frequency: "10m",
          name: "DNS monitor",
          regions: ["ams"],
          request: { uri: "example.com" },
          assertions,
        }),
      });
      expect(res.status).toBe(200);
      const created = MonitorSchema.parse(await res.json());
      expect(created.assertions).toEqual(expected);

      const read = await app.request(`/v1/monitor/${created.id}`, { headers });
      expect(read.status).toBe(200);
      expect(MonitorSchema.parse(await read.json()).assertions).toEqual(
        expected,
      );

      const stored = selectMonitorSchema.parse(
        await db
          .select()
          .from(monitor)
          .where(
            and(
              eq(monitor.id, created.id),
              eq(monitor.workspaceId, workspace.id),
            ),
          )
          .get(),
      );
      const payload = getCheckerPayload(stored, "active");
      expect("assertions" in payload && payload.assertions).toEqual(
        expected?.map((assertion) => ({ ...assertion, version: "v1" })) ?? null,
      );
      if (expected) {
        const conditions = deserialize(stored.assertions ?? "");
        expect(
          conditions.map(
            (condition) =>
              condition.assert({
                records: { A: ["192.0.2.1"], CNAME: ["www.example.com"] },
              }).success,
          ),
        ).toEqual([true, true]);
        expect(
          conditions.map(
            (condition) =>
              condition.assert({
                records: { A: ["192.0.2.2"], CNAME: ["other.test"] },
              }).success,
          ),
        ).toEqual([false, false]);
      }
    } finally {
      await db.delete(monitor).where(eq(monitor.workspaceId, workspace.id));
    }
  });
}

test("create a status report with invalid payload should return 400", async () => {
  const { workspace } = await createTestWorkspace();
  const res = await app.request("/v1/monitor/dns", {
    method: "POST",
    headers: {
      "x-openstatus-key": String(workspace.id),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "21m",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        url: "openstatus.dev",
      },
      active: true,
      public: true,
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/dns", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});
