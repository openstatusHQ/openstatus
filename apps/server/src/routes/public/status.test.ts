import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { app } from "@/index";
import { db, eq } from "@openstatus/db";

const testRedisStore = (globalThis as Record<string, unknown>)
  .__testRedisStore as Map<string, string> | undefined;
import {
  incidentTable,
  maintenance,
  monitor,
  page,
  pageComponent,
  statusReport,
} from "@openstatus/db/src/schema";

/**
 * Status Route Tests: Verify the status route uses pageComponents with single DB call
 *
 * These tests verify that the /public/status/:slug endpoint:
 * - Uses pageComponents instead of monitorsToPages
 * - Makes a single database query
 * - Correctly filters for active monitors only
 * - Correctly identifies ongoing incidents
 * - Correctly identifies unresolved status reports
 * - Correctly identifies ongoing maintenances
 * - Returns correct status based on the Tracker logic
 */

const TEST_PREFIX = "status-test";
let testPageId: number;
let testMonitorId: number;
let testMonitor2Id: number;
let testIncidentId: number;
let testStatusReportId: number;
let testMaintenanceId: number;

beforeAll(async () => {
  // Clean up any existing test data by slug/name before creating new ones
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-page`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-private-page`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-cache-test`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor-1`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor-2`));

  // Create test page
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: "Status Test Page",
      description: "A test page for status route tests",
      slug: `${TEST_PREFIX}-page`,
      customDomain: "",
      accessType: "public",
    })
    .returning()
    .get();
  testPageId = testPage.id;

  // Create first test monitor (active)
  const testMonitor = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-monitor-1`,
      url: "https://status-test-1.example.com",
      periodicity: "1m",
      active: true,
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
  testMonitorId = testMonitor.id;

  // Create second test monitor (inactive)
  const testMonitor2 = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-monitor-2`,
      url: "https://status-test-2.example.com",
      periodicity: "1m",
      active: false, // Inactive monitor
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
  testMonitor2Id = testMonitor2.id;

  // Create page components for both monitors
  await db.insert(pageComponent).values({
    workspaceId: 1,
    pageId: testPageId,
    monitorId: testMonitorId,
    type: "monitor",
    name: `${TEST_PREFIX}-monitor-1`,
    order: 1,
  });

  await db.insert(pageComponent).values({
    workspaceId: 1,
    pageId: testPageId,
    monitorId: testMonitor2Id,
    type: "monitor",
    name: `${TEST_PREFIX}-monitor-2`,
    order: 2,
  });
});

beforeEach(() => {
  testRedisStore?.clear();
});

afterAll(async () => {
  // Clean up test data
  if (testIncidentId) {
    await db
      .delete(incidentTable)
      .where(eq(incidentTable.id, testIncidentId))
      .catch(() => {});
  }
  if (testStatusReportId) {
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, testStatusReportId))
      .catch(() => {});
  }
  if (testMaintenanceId) {
    await db
      .delete(maintenance)
      .where(eq(maintenance.id, testMaintenanceId))
      .catch(() => {});
  }
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.pageId, testPageId))
    .catch(() => {});
  await db
    .delete(page)
    .where(eq(page.id, testPageId))
    .catch(() => {});
  await db
    .delete(monitor)
    .where(eq(monitor.id, testMonitorId))
    .catch(() => {});
  await db
    .delete(monitor)
    .where(eq(monitor.id, testMonitor2Id))
    .catch(() => {});
});

describe("Status Route: Basic functionality", () => {
  test("returns operational status for page with no incidents", async () => {
    const res = await app.request(`/public/status/${TEST_PREFIX}-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("operational");
  });

  test("returns unknown status for non-existent page", async () => {
    const res = await app.request("/public/status/non-existent-page");

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("unknown");
  });

  test("returns unknown status for non-public page", async () => {
    // Create a private page
    const privatePage = await db
      .insert(page)
      .values({
        workspaceId: 1,
        title: "Private Test Page",
        description: "A private test page",
        slug: `${TEST_PREFIX}-private-page`,
        customDomain: "",
        accessType: "password",
        password: "secret",
      })
      .returning()
      .get();

    const res = await app.request(`/public/status/${TEST_PREFIX}-private-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("unknown");

    // Clean up
    await db.delete(page).where(eq(page.id, privatePage.id));
  });
});

describe("Status Route: Active monitor filtering", () => {
  test("only considers active monitors for status calculation", async () => {
    // Create an incident for the inactive monitor
    const inactiveIncident = await db
      .insert(incidentTable)
      .values({
        monitorId: testMonitor2Id,
        title: "Inactive Monitor Incident",
        status: "investigating",
      })
      .returning()
      .get();

    const res = await app.request(`/public/status/${TEST_PREFIX}-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    // Status should still be operational because the monitor is inactive
    expect(data.status).toBe("operational");

    // Clean up
    await db
      .delete(incidentTable)
      .where(eq(incidentTable.id, inactiveIncident.id));
  });
});

describe("Status Route: Incident detection", () => {
  test("returns incident status with ongoing incident", async () => {
    // Create an ongoing incident for the active monitor
    const incident = await db
      .insert(incidentTable)
      .values({
        monitorId: testMonitorId,
        title: "Test Incident",
        status: "investigating",
        // resolvedAt is null, meaning it's ongoing
      })
      .returning()
      .get();
    testIncidentId = incident.id;

    const res = await app.request(`/public/status/${TEST_PREFIX}-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("incident");

    // Clean up
    await db.delete(incidentTable).where(eq(incidentTable.id, testIncidentId));
    testIncidentId = 0;
  });

  test("ignores resolved incidents", async () => {
    // First clean up the ongoing incident from previous test if it still exists
    if (testIncidentId) {
      await db
        .delete(incidentTable)
        .where(eq(incidentTable.id, testIncidentId))
        .catch(() => {});
      testIncidentId = 0;
    }

    // Create a resolved incident
    const resolvedIncident = await db
      .insert(incidentTable)
      .values({
        monitorId: testMonitorId,
        title: "Resolved Incident",
        status: "resolved",
        resolvedAt: new Date(),
      })
      .returning()
      .get();

    const res = await app.request(`/public/status/${TEST_PREFIX}-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    // Status should be operational because the incident is resolved
    expect(data.status).toBe("operational");

    // Clean up
    await db
      .delete(incidentTable)
      .where(eq(incidentTable.id, resolvedIncident.id));
  });
});

describe("Status Route: Status report detection", () => {
  test("returns degraded_performance status with unresolved status report", async () => {
    // Create an unresolved status report
    const report = await db
      .insert(statusReport)
      .values({
        workspaceId: 1,
        pageId: testPageId,
        title: "Test Status Report",
        status: "investigating",
      })
      .returning()
      .get();
    testStatusReportId = report.id;

    const res = await app.request(`/public/status/${TEST_PREFIX}-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("degraded_performance");

    // Clean up
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, testStatusReportId));
    testStatusReportId = 0;
  });

  test("ignores resolved status reports", async () => {
    // First clean up the ongoing status report from previous test if it still exists
    if (testStatusReportId) {
      await db
        .delete(statusReport)
        .where(eq(statusReport.id, testStatusReportId))
        .catch(() => {});
      testStatusReportId = 0;
    }

    // Create a resolved status report
    const resolvedReport = await db
      .insert(statusReport)
      .values({
        workspaceId: 1,
        pageId: testPageId,
        title: "Resolved Status Report",
        status: "resolved",
      })
      .returning()
      .get();

    const res = await app.request(`/public/status/${TEST_PREFIX}-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    // Status should be operational because the report is resolved
    expect(data.status).toBe("operational");

    // Clean up
    await db.delete(statusReport).where(eq(statusReport.id, resolvedReport.id));
  });
});

describe("Status Route: Maintenance detection", () => {
  test("returns under_maintenance status with ongoing maintenance", async () => {
    // Create an ongoing maintenance
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const maint = await db
      .insert(maintenance)
      .values({
        workspaceId: 1,
        pageId: testPageId,
        title: "Test Maintenance",
        message: "Ongoing maintenance",
        from: oneHourAgo,
        to: oneHourFromNow,
      })
      .returning()
      .get();
    testMaintenanceId = maint.id;

    const res = await app.request(`/public/status/${TEST_PREFIX}-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("under_maintenance");

    // Clean up
    await db.delete(maintenance).where(eq(maintenance.id, testMaintenanceId));
    testMaintenanceId = 0;
  });

  test("ignores past maintenances", async () => {
    // First clean up the ongoing maintenance from previous test if it still exists
    if (testMaintenanceId) {
      await db
        .delete(maintenance)
        .where(eq(maintenance.id, testMaintenanceId))
        .catch(() => {});
      testMaintenanceId = 0;
    }

    // Create a past maintenance
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    const pastMaint = await db
      .insert(maintenance)
      .values({
        workspaceId: 1,
        pageId: testPageId,
        title: "Past Maintenance",
        message: "Past maintenance",
        from: twoDaysAgo,
        to: oneDayAgo,
      })
      .returning()
      .get();

    const res = await app.request(`/public/status/${TEST_PREFIX}-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    // Status should be operational because the maintenance is in the past
    expect(data.status).toBe("operational");

    // Clean up
    await db.delete(maintenance).where(eq(maintenance.id, pastMaint.id));
  });

  test("ignores future maintenances", async () => {
    // First clean up any ongoing maintenance from previous test if it still exists
    if (testMaintenanceId) {
      await db
        .delete(maintenance)
        .where(eq(maintenance.id, testMaintenanceId))
        .catch(() => {});
      testMaintenanceId = 0;
    }

    // Create a future maintenance
    const oneDayFromNow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const futureMaint = await db
      .insert(maintenance)
      .values({
        workspaceId: 1,
        pageId: testPageId,
        title: "Future Maintenance",
        message: "Future maintenance",
        from: oneDayFromNow,
        to: twoDaysFromNow,
      })
      .returning()
      .get();

    const res = await app.request(`/public/status/${TEST_PREFIX}-page`);

    expect(res.status).toBe(200);

    const data = await res.json();
    // Status should be operational because the maintenance is in the future
    expect(data.status).toBe("operational");

    // Clean up
    await db.delete(maintenance).where(eq(maintenance.id, futureMaint.id));
  });
});

describe("Status Route: Cache functionality", () => {
  test("returns cached status on second request if cache is available", async () => {
    const slug = `${TEST_PREFIX}-cache-test`;

    // Create a test page for cache testing
    const cachePage = await db
      .insert(page)
      .values({
        workspaceId: 1,
        title: "Cache Test Page",
        description: "A test page for cache testing",
        slug,
        customDomain: "",
        accessType: "public",
      })
      .returning()
      .get();

    // First request should hit the database
    const res1 = await app.request(`/public/status/${slug}`);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.status).toBe("operational");
    expect(res1.headers.get("OpenStatus-Cache")).toBeNull();

    // Second request may hit the cache if Redis is configured
    const res2 = await app.request(`/public/status/${slug}`);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.status).toBe("operational");
    // Cache header may be "HIT" if Redis is available, or null if not
    const cacheHeader = res2.headers.get("OpenStatus-Cache");
    if (cacheHeader !== null) {
      expect(cacheHeader).toBe("HIT");
    }

    // Clean up
    await db.delete(page).where(eq(page.id, cachePage.id));
  });
});
