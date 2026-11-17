import { db, eq } from "@openstatus/db";
import {
  maintenance,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
} from "@openstatus/db/src/schema";
import { clearAuditLogFor } from "@openstatus/services/test/helpers";
import { beforeEach, expect, test } from "vitest";

import { app } from "@/index";

import { MaintenanceSchema } from "./schema";

const spies = (globalThis as any).__subscriptionSpies as {
  dispatchMaintenanceUpdate: {
    mockClear: () => void;
    mock: { calls: number[][] };
  };
};

beforeEach(() => {
  spies.dispatchMaintenanceUpdate.mockClear();
});

test("create a valid maintenance without monitorIds", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000); // 1 hour later

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Another Maintenance",
      message: "Scheduled maintenance without monitors",
      from: from.toISOString(),
      to: to.toISOString(),
      pageId: 1,
    }),
  });

  const result = MaintenanceSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.monitorIds?.length).toBe(0);

  // Cleanup: delete the created maintenance
  if (result.success) {
    await db.delete(maintenance).where(eq(maintenance.id, result.data.id));
  }
});

test("create a maintenance with `from` date after `to` date should return 400", async () => {
  const to = new Date();
  const from = new Date(to.getTime() + 3600000); // from is 1 hour after to

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Invalid Dates",
      message: "Test message",
      from: from.toISOString(),
      to: to.toISOString(),
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("create a maintenance with non-existent monitorIds should return 400", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000);

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Invalid Monitors",
      message: "Test message",
      from: from.toISOString(),
      to: to.toISOString(),
      monitorIds: [9999], // Non-existent monitor ID
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("create a maintenance with non-existent pageId should return 400", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000);

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Invalid Page",
      message: "Test message",
      from: from.toISOString(),
      to: to.toISOString(),
      monitorIds: [1],
      pageId: 9999, // Non-existent page ID
    }),
  });

  expect(res.status).toBe(400);
});

test("create a maintenance with empty body should return 400", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  expect(res.status).toBe(400);
});

test("create a valid maintenance", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000); // 1 hour later

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Database Upgrade",
      message: "Scheduled database maintenance",
      from: from.toISOString(),
      to: to.toISOString(),
      monitorIds: [1],
      pageId: 1,
    }),
  });
  const result = MaintenanceSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.monitorIds?.length).toBe(1);
  if (result.success) {
    await db.delete(maintenance).where(eq(maintenance.id, result.data.id));
  }
});

test("create a maintenance with multiple monitorIds", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000); // 1 hour later

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Multi-Monitor Maintenance",
      message: "Maintenance affecting multiple monitors",
      from: from.toISOString(),
      to: to.toISOString(),
      monitorIds: [1, 2],
      pageId: 1,
    }),
  });
  const result = MaintenanceSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.monitorIds?.length).toBe(2);
  expect(result.data?.monitorIds).toEqual(expect.arrayContaining([1, 2]));

  // Cleanup: delete the created maintenance
  if (result.success) {
    await db.delete(maintenance).where(eq(maintenance.id, result.data.id));
  }
});

test("create a maintenance with invalid dates should return 400", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Invalid Maintenance",
      message: "Test message",
      from: "invalid-date",
      to: "invalid-date",
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});

test("create a maintenance dispatches its first update", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000);

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Dispatch Test Maintenance",
      message: "Testing dispatcher integration",
      from: from.toISOString(),
      to: to.toISOString(),
      monitorIds: [1],
      pageId: 1,
    }),
  });

  expect(res.status).toBe(200);
  const result = MaintenanceSchema.safeParse(await res.json());
  expect(result.success).toBe(true);
  expect(spies.dispatchMaintenanceUpdate.mock.calls.length).toBe(1);
  expect(typeof spies.dispatchMaintenanceUpdate.mock.calls[0][0]).toBe(
    "number",
  );

  if (result.success) {
    await db.delete(maintenance).where(eq(maintenance.id, result.data.id));
  }
});

test("create a maintenance with an empty message should return 400", async () => {
  const from = new Date();
  const to = new Date(from.getTime() + 3600000);

  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Empty Message",
      message: "",
      from: from.toISOString(),
      to: to.toISOString(),
      monitorIds: [1],
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("a maintenance on monitors gets a derived pause window that follows it", async () => {
  const from = new Date(Math.floor(Date.now() / 1000) * 1000 + 3_600_000);
  const to = new Date(from.getTime() + 3_600_000);
  const headers = {
    "x-openstatus-key": "1",
    "content-type": "application/json",
  };
  const res = await app.request("/v1/maintenance", {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Derived window",
      message: "m",
      from: from.toISOString(),
      to: to.toISOString(),
      pageId: 1,
      monitorIds: [1],
    }),
  });
  expect(res.status).toBe(200);
  const { id } = MaintenanceSchema.parse(await res.json());
  const derived = () =>
    db
      .select()
      .from(monitorMaintenanceWindow)
      .where(eq(monitorMaintenanceWindow.maintenanceId, id))
      .get();
  const windowIds: number[] = [];

  try {
    const created = await derived();
    expect(created).toMatchObject({ mode: "pause", from, to });
    if (created) windowIds.push(created.id);
    const links = await db
      .select()
      .from(monitorMaintenanceWindowToMonitor)
      .where(
        eq(
          monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
          created?.id ?? 0,
        ),
      )
      .all();
    expect(links.map((l) => l.monitorId)).toEqual([1]);

    const later = new Date(to.getTime() + 3_600_000);
    const moved = await app.request(`/v1/maintenance/${id}`, {
      method: "PUT",
      headers,
      // the PUT schema defaults `monitorIds` to [], which would clear them
      body: JSON.stringify({ to: later.toISOString(), monitorIds: [1] }),
    });
    expect(moved.status).toBe(200);
    expect((await derived())?.to).toEqual(later);

    const cleared = await app.request(`/v1/maintenance/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ monitorIds: [] }),
    });
    expect(cleared.status).toBe(200);
    expect(await derived()).toBeUndefined();
  } finally {
    await db.delete(maintenance).where(eq(maintenance.id, id));
    await clearAuditLogFor({
      entityType: "monitor_maintenance_window",
      entityIds: windowIds,
    });
  }
});
