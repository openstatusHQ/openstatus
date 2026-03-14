import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  monitor,
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { app } from "@/index";
import { StatusReportSchema } from "./schema";

const TEST_PREFIX = "v1-sr-getall-test";
let testMonitorId: number;
let testPageComponentId: number;
let testStatusReportId: number;

beforeAll(async () => {
  await db
    .delete(statusReport)
    .where(eq(statusReport.title, `${TEST_PREFIX}-report`));
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

  const report = await db
    .insert(statusReport)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-report`,
      status: "investigating",
    })
    .returning()
    .get();
  testStatusReportId = report.id;

  await db.insert(statusReportUpdate).values({
    statusReportId: testStatusReportId,
    status: "investigating",
    message: "Test investigating",
    date: new Date("2099-01-01T00:00:00Z"),
  });

  await db.insert(statusReportsToPageComponents).values({
    statusReportId: testStatusReportId,
    pageComponentId: testPageComponentId,
  });
});

afterAll(async () => {
  await db
    .delete(statusReportsToPageComponents)
    .where(eq(statusReportsToPageComponents.statusReportId, testStatusReportId));
  await db
    .delete(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, testStatusReportId));
  await db
    .delete(statusReport)
    .where(eq(statusReport.title, `${TEST_PREFIX}-report`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));
});

test("return all status reports", async () => {
  const res = await app.request("/v1/status_report", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = StatusReportSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.some((r) => r.id === testStatusReportId)).toBe(true);
});

test("return all status reports with monitorIds", async () => {
  const res = await app.request("/v1/status_report", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = StatusReportSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  const testReport = result.data?.find((r) => r.id === testStatusReportId);
  expect(testReport).toBeDefined();
  expect(testReport?.monitorIds).toBeDefined();
  expect(Array.isArray(testReport?.monitorIds)).toBe(true);
  expect(testReport?.monitorIds).toContain(testMonitorId);
});

test("return empty status reports", async () => {
  const res = await app.request("/v1/status_report", {
    method: "GET",
    headers: {
      "x-openstatus-key": "3",
    },
  });

  const result = StatusReportSchema.array().safeParse(await res.json());

  expect(result.success).toBe(true);
  expect(res.status).toBe(200);
  expect(result.data?.length).toBe(0);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/status_report", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});
