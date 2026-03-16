import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { incidentTable, monitor } from "@openstatus/db/src/schema";

import { app } from "@/index";
import { IncidentSchema } from "./schema";

const TEST_PREFIX = "v1-incident-getall-test";
let testMonitorId: number;
let testIncidentId: number;

beforeAll(async () => {
  await db
    .delete(incidentTable)
    .where(eq(incidentTable.title, `${TEST_PREFIX}-incident`));
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

  const incident = await db
    .insert(incidentTable)
    .values({
      workspaceId: 1,
      monitorId: testMonitorId,
      title: `${TEST_PREFIX}-incident`,
      status: "investigating",
      startedAt: new Date("2099-01-01T00:00:00Z"),
    })
    .returning()
    .get();
  testIncidentId = incident.id;
});

afterAll(async () => {
  await db
    .delete(incidentTable)
    .where(eq(incidentTable.title, `${TEST_PREFIX}-incident`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));
});

test("return all incidents", async () => {
  const res = await app.request("/v1/incident", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = IncidentSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.some((i) => i.id === testIncidentId)).toBe(true);
});

test("return empty incidents", async () => {
  const res = await app.request("/v1/incident", {
    method: "GET",
    headers: {
      "x-openstatus-key": "3",
    },
  });

  const result = IncidentSchema.array().safeParse(await res.json());

  expect(result.success).toBe(true);
  expect(res.status).toBe(200);
  expect(result.data?.length).toBe(0);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/incident", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});
