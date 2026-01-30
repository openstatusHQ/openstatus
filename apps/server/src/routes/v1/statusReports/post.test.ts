import { expect, test } from "bun:test";

import { app } from "@/index";
import { db, eq } from "@openstatus/db";
import {
  monitorsToStatusReport,
  pageComponent,
  statusReport,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import { StatusReportSchema } from "./schema";

test("create a valid status report", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report", {
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
      date: date.toISOString(),
      pageId: 1,
    }),
  });

  const result = StatusReportSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.statusReportUpdateIds?.length).toBeGreaterThan(0);
  expect(result.data?.monitorIds?.length).toBe(1);
  expect(result.data?.monitorIds).toEqual([1]);
});

test("create a status report with multiple monitorIds", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "Multi-Monitor Status Report",
      message: "Affecting multiple monitors",
      monitorIds: [1, 2],
      date: date.toISOString(),
      pageId: 1,
    }),
  });

  const result = StatusReportSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.monitorIds?.length).toBe(2);
  expect(result.data?.monitorIds).toEqual(expect.arrayContaining([1, 2]));
});

test("create a status report without monitorIds", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "General Status Report",
      message: "No specific monitors affected",
      date: date.toISOString(),
      pageId: 1,
    }),
  });

  const result = StatusReportSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.monitorIds).toBeDefined();
  expect(Array.isArray(result.data?.monitorIds)).toBe(true);
});

test("create a status report with partial invalid monitorIds should return 400", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "Partial Invalid Monitors",
      message: "One valid, one invalid",
      monitorIds: [1, 9999],
      date: date.toISOString(),
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("create a status report with invalid monitor should return 400", async () => {
  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "New Status Report",
      message: "Message",
      monitorIds: [404],
      pageId: 1,
    }),
  });

  expect(res.status).toBe(400);
});

test("create a status report with invalid page id should return 400", async () => {
  const res = await app.request("/v1/status_report", {
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
  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});

test("create a status report syncs correctly to statusReportsToPageComponents and legacy monitorsToStatusReport", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "Sync Test Status Report",
      message: "Testing sync to both tables",
      monitorIds: [1],
      date: date.toISOString(),
      pageId: 1,
    }),
  });

  expect(res.status).toBe(200);
  const result = StatusReportSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  if (result.success) {
    const statusReportId = result.data.id;

    // Verify statusReportsToPageComponents (primary table)
    const components = await db
      .select()
      .from(statusReportsToPageComponents)
      .where(eq(statusReportsToPageComponents.statusReportId, statusReportId))
      .all();

    expect(components.length).toBeGreaterThan(0);

    // Get the page component to verify it's linked correctly
    const pageComponents = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.id, components[0].pageComponentId))
      .all();

    expect(pageComponents.length).toBe(1);
    expect(pageComponents[0].monitorId).toBe(1);
    expect(pageComponents[0].pageId).toBe(1);
    expect(pageComponents[0].type).toBe("monitor");

    // Verify monitorsToStatusReport (legacy table)
    const legacyEntries = await db
      .select()
      .from(monitorsToStatusReport)
      .where(eq(monitorsToStatusReport.statusReportId, statusReportId))
      .all();

    expect(legacyEntries.length).toBe(1);
    expect(legacyEntries[0].monitorId).toBe(1);

    // Cleanup
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, statusReportId))
      .run();
  }
});

test("create a status report with multiple monitors syncs correctly to both tables", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  // First, check which monitors from [1, 2] exist as page components on page 1
  const existingPageComponents = await db
    .select()
    .from(pageComponent)
    .where(eq(pageComponent.pageId, 1))
    .all();

  const existingMonitorIds = existingPageComponents
    .filter((c) => c.monitorId !== null && c.type === "monitor" && [1, 2].includes(c.monitorId))
    .map((c) => c.monitorId as number);

  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "Multi-Monitor Sync Test",
      message: "Testing sync with multiple monitors",
      monitorIds: [1, 2],
      date: date.toISOString(),
      pageId: 1,
    }),
  });

  expect(res.status).toBe(200);
  const result = StatusReportSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  if (result.success) {
    const statusReportId = result.data.id;

    // Verify statusReportsToPageComponents (primary table)
    const components = await db
      .select()
      .from(statusReportsToPageComponents)
      .where(eq(statusReportsToPageComponents.statusReportId, statusReportId))
      .all();

    // Should only link monitors that exist as page components on this page
    expect(components.length).toBe(existingMonitorIds.length);

    // Verify monitorsToStatusReport (legacy table)
    const legacyEntries = await db
      .select()
      .from(monitorsToStatusReport)
      .where(eq(monitorsToStatusReport.statusReportId, statusReportId))
      .all();

    // Both tables should have the same number of entries
    expect(legacyEntries.length).toBe(components.length);

    // Verify the monitor IDs in legacy table match what we expect
    const legacyMonitorIds = legacyEntries.map((e) => e.monitorId).sort();
    expect(legacyMonitorIds).toEqual(existingMonitorIds.sort());

    // Cleanup
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, statusReportId))
      .run();
  }
});

test("create a status report without monitorIds should not create sync entries", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "No Monitors Status Report",
      message: "No specific monitors affected",
      date: date.toISOString(),
      pageId: 1,
    }),
  });

  expect(res.status).toBe(200);
  const result = StatusReportSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  if (result.success) {
    const statusReportId = result.data.id;

    // Verify no statusReportsToPageComponents entries
    const components = await db
      .select()
      .from(statusReportsToPageComponents)
      .where(eq(statusReportsToPageComponents.statusReportId, statusReportId))
      .all();

    expect(components.length).toBe(0);

    // Verify no monitorsToStatusReport entries
    const legacyEntries = await db
      .select()
      .from(monitorsToStatusReport)
      .where(eq(monitorsToStatusReport.statusReportId, statusReportId))
      .all();

    expect(legacyEntries.length).toBe(0);

    // Cleanup
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, statusReportId))
      .run();
  }
});

test("create a status report only links monitors that exist as page components", async () => {
  const date = new Date();
  date.setMilliseconds(0);

  // First, check which monitors exist as page components on page 1
  const existingComponents = await db
    .select()
    .from(pageComponent)
    .where(eq(pageComponent.pageId, 1))
    .all();

  const existingMonitorIds = existingComponents
    .filter((c) => c.monitorId !== null && c.type === "monitor")
    .map((c) => c.monitorId as number);

  if (existingMonitorIds.length === 0) {
    // Skip test if no monitors exist on the page
    return;
  }

  const res = await app.request("/v1/status_report", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: "investigating",
      title: "Page Component Link Test",
      message: "Testing page component linking",
      monitorIds: existingMonitorIds,
      date: date.toISOString(),
      pageId: 1,
    }),
  });

  expect(res.status).toBe(200);
  const result = StatusReportSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  if (result.success) {
    const statusReportId = result.data.id;

    // Verify statusReportsToPageComponents entries match existing components
    const components = await db
      .select()
      .from(statusReportsToPageComponents)
      .where(eq(statusReportsToPageComponents.statusReportId, statusReportId))
      .all();

    // Each linked component should correspond to a page component
    for (const component of components) {
      const pageComp = await db
        .select()
        .from(pageComponent)
        .where(eq(pageComponent.id, component.pageComponentId))
        .get();

      expect(pageComp).toBeDefined();
      expect(pageComp?.pageId).toBe(1);
      expect(existingMonitorIds).toContain(pageComp?.monitorId as number);
    }

    // Cleanup
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, statusReportId))
      .run();
  }
});
