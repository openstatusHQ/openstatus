import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  pageComponent,
} from "@openstatus/db/src/schema";

import { app } from "@/index";
import { MaintenanceSchema } from "./schema";

const TEST_PREFIX = "v1-maint-getall-test";
let testMonitorId: number;
let testPageComponentId: number;
let testMaintenanceId: number;

beforeAll(async () => {
  await db
    .delete(maintenance)
    .where(eq(maintenance.title, `${TEST_PREFIX}-maint`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));

  const mon = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-monitor`,
      url: "https://test.example.com",
      periodicity: "1m",
      active: true,
      regions: "ams",
      jobType: "http",
      method: "GET",
      timeout: 30000,
    })
    .returning()
    .get();
  testMonitorId = mon.id;

  const comp = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: 1,
      monitorId: testMonitorId,
      type: "monitor",
      name: `${TEST_PREFIX}-component`,
      order: 200,
    })
    .returning()
    .get();
  testPageComponentId = comp.id;

  const maint = await db
    .insert(maintenance)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-maint`,
      message: "Test maintenance",
      from: new Date("2099-01-01T00:00:00Z"),
      to: new Date("2099-01-02T00:00:00Z"),
    })
    .returning()
    .get();
  testMaintenanceId = maint.id;

  await db.insert(maintenancesToPageComponents).values({
    maintenanceId: testMaintenanceId,
    pageComponentId: testPageComponentId,
  });
});

afterAll(async () => {
  await db
    .delete(maintenancesToPageComponents)
    .where(eq(maintenancesToPageComponents.maintenanceId, testMaintenanceId));
  await db
    .delete(maintenance)
    .where(eq(maintenance.title, `${TEST_PREFIX}-maint`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));
});

test("return all maintenances", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = MaintenanceSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.some((m) => m.id === testMaintenanceId)).toBe(true);
});

test("return all maintenances with monitorIds", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = MaintenanceSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  const testMaint = result.data?.find((m) => m.id === testMaintenanceId);
  expect(testMaint).toBeDefined();
  expect(testMaint?.monitorIds).toBeDefined();
  expect(Array.isArray(testMaint?.monitorIds)).toBe(true);
  expect(testMaint?.monitorIds).toContain(testMonitorId);
});

test("return empty maintenances", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "GET",
    headers: {
      "x-openstatus-key": "3",
    },
  });

  const result = MaintenanceSchema.array().safeParse(await res.json());

  expect(result.success).toBe(true);
  expect(res.status).toBe(200);
  expect(result.data?.length).toBe(0);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/maintenance", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});
