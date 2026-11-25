import { db, eq } from "@openstatus/db";
import { monitor, workspace } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { app } from "@/index";

const requests = {
  http: { url: "https://example.com", method: "GET" },
  tcp: { host: "example.com", port: 443 },
  dns: { uri: "example.com" },
};

for (const jobType of ["http", "tcp", "dns"] as const) {
  test(`${jobType} updates reject excess and disallowed regions without mutation`, async () => {
    const fixture = await createTestWorkspace({
      limits: JSON.stringify({ "max-regions": 1, regions: ["ams", "iad"] }),
    });
    const original = await createMonitor(fixture.workspace.id, {
      jobType,
      regions: "ams",
      periodicity: "10m",
    });

    for (const regions of [["ams", "iad"], ["sin"]]) {
      const res = await app.request(`/v1/monitor/${jobType}/${original.id}`, {
        method: "PUT",
        headers: {
          "x-openstatus-key": String(fixture.workspace.id),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Must not change",
          frequency: "10m",
          regions,
          request: requests[jobType],
        }),
      });
      const stored = await db
        .select()
        .from(monitor)
        .where(eq(monitor.id, original.id))
        .get();

      expect(stored).toEqual(original);
      expect(res.status).toBe(402);
      expect(await res.json()).toMatchObject({ code: "PAYMENT_REQUIRED" });
    }
  });
}

for (const jobType of ["http", "tcp"] as const) {
  test(`${jobType} updates accept the effective region limit after an override changes`, async () => {
    const fixture = await createTestWorkspace({
      limits: JSON.stringify({ "max-regions": 1 }),
    });
    const original = await createMonitor(fixture.workspace.id, {
      jobType,
      regions: "ams",
      periodicity: "10m",
    });

    for (const regions of [["iad"], ["ams", "iad"]]) {
      await db
        .update(workspace)
        .set({ limits: JSON.stringify({ "max-regions": regions.length }) })
        .where(eq(workspace.id, fixture.workspace.id));
      const res = await app.request(`/v1/monitor/${jobType}/${original.id}`, {
        method: "PUT",
        headers: {
          "x-openstatus-key": String(fixture.workspace.id),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "At limit",
          frequency: "10m",
          regions,
          request: requests[jobType],
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ regions });
      const stored = await db
        .select()
        .from(monitor)
        .where(eq(monitor.id, original.id))
        .get();
      expect(stored?.regions).toBe(regions.join(","));
    }
  });
}
