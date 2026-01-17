import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, db, eq, inArray } from "@openstatus/db";
import {
  maintenance,
  maintenancesToMonitors,
  maintenancesToPageComponents,
  monitor,
  monitorsToPages,
  monitorsToStatusReport,
  page,
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { app } from "@/index";

/**
 * Sync Tests for REST API: Verify that mutations to legacy tables also sync to new page_component tables
 *
 * These tests use the REST API endpoints and verify that the sync operations
 * correctly update the new page_component related tables.
 */

const TEST_PREFIX = "api-sync-test";
let testPageId: number;
let testMonitorId: number;

beforeAll(async () => {
  // Clean up any existing test data
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-monitor`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-page`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));

  // Create test page
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: "API Sync Test Page",
      description: "A test page for API sync tests",
      slug: `${TEST_PREFIX}-page`,
      customDomain: "",
    })
    .returning()
    .get();
  testPageId = testPage.id;

  // Create test monitor
  const testMonitor = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-monitor`,
      url: "https://api-sync-test.example.com",
      periodicity: "1m",
      active: true,
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
  testMonitorId = testMonitor.id;

  // Add monitor to page (creates monitors_to_pages entry)
  await db.insert(monitorsToPages).values({
    monitorId: testMonitorId,
    pageId: testPageId,
  });

  // Create page_component for the monitor (simulating initial sync)
  await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: testPageId,
      monitorId: testMonitorId,
      type: "monitor",
      name: `${TEST_PREFIX}-monitor`,
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  // Clean up test data in correct order
  await db
    .delete(maintenancesToPageComponents)
    .where(
      inArray(
        maintenancesToPageComponents.pageComponentId,
        db
          .select({ id: pageComponent.id })
          .from(pageComponent)
          .where(eq(pageComponent.pageId, testPageId)),
      ),
    );
  await db
    .delete(statusReportsToPageComponents)
    .where(
      inArray(
        statusReportsToPageComponents.pageComponentId,
        db
          .select({ id: pageComponent.id })
          .from(pageComponent)
          .where(eq(pageComponent.pageId, testPageId)),
      ),
    );
  await db.delete(pageComponent).where(eq(pageComponent.pageId, testPageId));
  await db
    .delete(monitorsToPages)
    .where(eq(monitorsToPages.pageId, testPageId));
  await db
    .delete(maintenancesToMonitors)
    .where(eq(maintenancesToMonitors.monitorId, testMonitorId));
  await db
    .delete(monitorsToStatusReport)
    .where(eq(monitorsToStatusReport.monitorId, testMonitorId));
  await db
    .delete(statusReportUpdate)
    .where(
      inArray(
        statusReportUpdate.statusReportId,
        db
          .select({ id: statusReport.id })
          .from(statusReport)
          .where(eq(statusReport.pageId, testPageId)),
      ),
    );
  await db.delete(statusReport).where(eq(statusReport.pageId, testPageId));
  await db.delete(maintenance).where(eq(maintenance.pageId, testPageId));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-page`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));
});

describe("API Sync: POST /v1/maintenance - maintenance_to_page_component", () => {
  let createdMaintenanceId: number;

  afterAll(async () => {
    if (createdMaintenanceId) {
      await db
        .delete(maintenancesToPageComponents)
        .where(
          eq(maintenancesToPageComponents.maintenanceId, createdMaintenanceId),
        );
      await db
        .delete(maintenancesToMonitors)
        .where(eq(maintenancesToMonitors.maintenanceId, createdMaintenanceId));
      await db
        .delete(maintenance)
        .where(eq(maintenance.id, createdMaintenanceId));
    }
  });

  test("creating maintenance with monitors syncs to maintenance_to_page_component", async () => {
    const from = new Date();
    const to = new Date(from.getTime() + 3600000);

    const res = await app.request("/v1/maintenance", {
      method: "POST",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: `${TEST_PREFIX} Maintenance`,
        message: "Test maintenance for sync",
        from: from.toISOString(),
        to: to.toISOString(),
        monitorIds: [testMonitorId],
        pageId: testPageId,
      }),
    });

    expect(res.status).toBe(200);

    const data = await res.json();
    createdMaintenanceId = data.id;

    // Verify maintenance_to_monitor was created
    const maintenanceToMonitor =
      await db.query.maintenancesToMonitors.findFirst({
        where: and(
          eq(maintenancesToMonitors.maintenanceId, createdMaintenanceId),
          eq(maintenancesToMonitors.monitorId, testMonitorId),
        ),
      });
    expect(maintenanceToMonitor).toBeDefined();

    // Verify maintenance_to_page_component was synced
    const component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, testPageId),
      ),
    });

    if (component) {
      const maintenanceToComponent =
        await db.query.maintenancesToPageComponents.findFirst({
          where: and(
            eq(
              maintenancesToPageComponents.maintenanceId,
              createdMaintenanceId,
            ),
            eq(maintenancesToPageComponents.pageComponentId, component.id),
          ),
        });
      expect(maintenanceToComponent).toBeDefined();
    }
  });
});

describe("API Sync: PUT /v1/maintenance - maintenance_to_page_component updates", () => {
  let testMaintenanceId: number;

  beforeAll(async () => {
    // Create a maintenance for update tests
    const from = new Date();
    const to = new Date(from.getTime() + 3600000);

    const newMaintenance = await db
      .insert(maintenance)
      .values({
        workspaceId: 1,
        pageId: testPageId,
        title: `${TEST_PREFIX} Update Test Maintenance`,
        message: "For update tests",
        from,
        to,
      })
      .returning()
      .get();
    testMaintenanceId = newMaintenance.id;

    // Add monitor to maintenance
    await db.insert(maintenancesToMonitors).values({
      maintenanceId: testMaintenanceId,
      monitorId: testMonitorId,
    });

    // Sync to page component
    const component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, testPageId),
      ),
    });

    if (component) {
      await db
        .insert(maintenancesToPageComponents)
        .values({
          maintenanceId: testMaintenanceId,
          pageComponentId: component.id,
        })
        .onConflictDoNothing();
    }
  });

  afterAll(async () => {
    if (testMaintenanceId) {
      await db
        .delete(maintenancesToPageComponents)
        .where(
          eq(maintenancesToPageComponents.maintenanceId, testMaintenanceId),
        );
      await db
        .delete(maintenancesToMonitors)
        .where(eq(maintenancesToMonitors.maintenanceId, testMaintenanceId));
      await db.delete(maintenance).where(eq(maintenance.id, testMaintenanceId));
    }
  });

  test("removing monitors from maintenance syncs delete to maintenance_to_page_component", async () => {
    const res = await app.request(`/v1/maintenance/${testMaintenanceId}`, {
      method: "PUT",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        monitorIds: [],
      }),
    });

    expect(res.status).toBe(200);

    // Verify maintenance_to_monitor was deleted
    const maintenanceToMonitor =
      await db.query.maintenancesToMonitors.findFirst({
        where: and(
          eq(maintenancesToMonitors.maintenanceId, testMaintenanceId),
          eq(maintenancesToMonitors.monitorId, testMonitorId),
        ),
      });
    expect(maintenanceToMonitor).toBeUndefined();

    // Verify maintenance_to_page_component was also deleted
    const maintenanceToComponent =
      await db.query.maintenancesToPageComponents.findFirst({
        where: eq(
          maintenancesToPageComponents.maintenanceId,
          testMaintenanceId,
        ),
      });
    expect(maintenanceToComponent).toBeUndefined();
  });
});

describe("API Sync: POST /v1/status_report - status_report_to_page_component", () => {
  let createdStatusReportId: number;

  afterAll(async () => {
    if (createdStatusReportId) {
      await db
        .delete(statusReportsToPageComponents)
        .where(
          eq(
            statusReportsToPageComponents.statusReportId,
            createdStatusReportId,
          ),
        );
      await db
        .delete(monitorsToStatusReport)
        .where(
          eq(monitorsToStatusReport.statusReportId, createdStatusReportId),
        );
      await db
        .delete(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, createdStatusReportId));
      await db
        .delete(statusReport)
        .where(eq(statusReport.id, createdStatusReportId));
    }
  });

  test("creating status report with monitors syncs to status_report_to_page_component", async () => {
    const res = await app.request("/v1/status_report", {
      method: "POST",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: `${TEST_PREFIX} Status Report`,
        status: "investigating",
        message: "Test status report for sync",
        monitorIds: [testMonitorId],
        pageId: testPageId,
      }),
    });

    expect(res.status).toBe(200);

    const data = await res.json();
    createdStatusReportId = data.id;

    // Verify status_report_to_monitors was created
    const reportToMonitor = await db.query.monitorsToStatusReport.findFirst({
      where: and(
        eq(monitorsToStatusReport.statusReportId, createdStatusReportId),
        eq(monitorsToStatusReport.monitorId, testMonitorId),
      ),
    });
    expect(reportToMonitor).toBeDefined();

    // Verify status_report_to_page_component was synced
    const component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, testPageId),
      ),
    });

    if (component) {
      const reportToComponent =
        await db.query.statusReportsToPageComponents.findFirst({
          where: and(
            eq(
              statusReportsToPageComponents.statusReportId,
              createdStatusReportId,
            ),
            eq(statusReportsToPageComponents.pageComponentId, component.id),
          ),
        });
      expect(reportToComponent).toBeDefined();
    }
  });
});

describe("API Sync: POST /v1/page - monitors_to_pages -> page_component", () => {
  let createdPageId: number;

  afterAll(async () => {
    if (createdPageId) {
      await db
        .delete(pageComponent)
        .where(eq(pageComponent.pageId, createdPageId));
      await db
        .delete(monitorsToPages)
        .where(eq(monitorsToPages.pageId, createdPageId));
      await db.delete(page).where(eq(page.id, createdPageId));
    }
  });

  test("creating page with monitors syncs to page_component", async () => {
    const res = await app.request("/v1/page", {
      method: "POST",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: `${TEST_PREFIX} New Page`,
        description: "Test page for sync",
        slug: `${TEST_PREFIX}-new-page`,
        monitors: [testMonitorId],
      }),
    });

    expect(res.status).toBe(200);

    const data = await res.json();
    createdPageId = data.id;

    // Verify monitors_to_pages was created
    const monitorToPage = await db.query.monitorsToPages.findFirst({
      where: and(
        eq(monitorsToPages.monitorId, testMonitorId),
        eq(monitorsToPages.pageId, createdPageId),
      ),
    });
    expect(monitorToPage).toBeDefined();

    // Verify page_component was synced
    const component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, createdPageId),
      ),
    });
    expect(component).toBeDefined();
    expect(component?.type).toBe("monitor");
  });
});

describe("API Sync: PUT /v1/page - monitors_to_pages -> page_component updates", () => {
  let updateTestPageId: number;

  beforeAll(async () => {
    // Create a page for update tests
    const updateTestPage = await db
      .insert(page)
      .values({
        workspaceId: 1,
        title: `${TEST_PREFIX} Update Test Page`,
        description: "For update tests",
        slug: `${TEST_PREFIX}-update-page`,
        customDomain: "",
      })
      .returning()
      .get();
    updateTestPageId = updateTestPage.id;
  });

  afterAll(async () => {
    if (updateTestPageId) {
      await db
        .delete(pageComponent)
        .where(eq(pageComponent.pageId, updateTestPageId));
      await db
        .delete(monitorsToPages)
        .where(eq(monitorsToPages.pageId, updateTestPageId));
      await db.delete(page).where(eq(page.id, updateTestPageId));
    }
  });

  test("adding monitors to page syncs to page_component", async () => {
    const res = await app.request(`/v1/page/${updateTestPageId}`, {
      method: "PUT",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        monitors: [testMonitorId],
      }),
    });

    expect(res.status).toBe(200);

    // Verify monitors_to_pages was created
    const monitorToPage = await db.query.monitorsToPages.findFirst({
      where: and(
        eq(monitorsToPages.monitorId, testMonitorId),
        eq(monitorsToPages.pageId, updateTestPageId),
      ),
    });
    expect(monitorToPage).toBeDefined();

    // Verify page_component was synced
    const component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, updateTestPageId),
      ),
    });
    expect(component).toBeDefined();
  });

  test("removing monitors from page syncs delete to page_component", async () => {
    // First ensure monitor is on the page
    await db
      .insert(monitorsToPages)
      .values({
        monitorId: testMonitorId,
        pageId: updateTestPageId,
      })
      .onConflictDoNothing();

    await db
      .insert(pageComponent)
      .values({
        workspaceId: 1,
        pageId: updateTestPageId,
        monitorId: testMonitorId,
        type: "monitor",
        name: `${TEST_PREFIX}-monitor`,
      })
      .onConflictDoNothing();

    // Verify page_component exists before removal
    let component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, updateTestPageId),
      ),
    });
    expect(component).toBeDefined();

    // Remove all monitors
    const res = await app.request(`/v1/page/${updateTestPageId}`, {
      method: "PUT",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        monitors: [],
      }),
    });

    expect(res.status).toBe(200);

    // Verify monitors_to_pages was deleted
    const monitorToPage = await db.query.monitorsToPages.findFirst({
      where: and(
        eq(monitorsToPages.monitorId, testMonitorId),
        eq(monitorsToPages.pageId, updateTestPageId),
      ),
    });
    expect(monitorToPage).toBeUndefined();

    // Verify page_component was deleted
    component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, updateTestPageId),
      ),
    });
    expect(component).toBeUndefined();
  });
});
