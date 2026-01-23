import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, db, eq, inArray } from "@openstatus/db";
import {
  maintenance,
  maintenancesToMonitors,
  maintenancesToPageComponents,
  monitor,
  monitorGroup,
  monitorsToPages,
  monitorsToStatusReport,
  page,
  pageComponent,
  pageComponentGroup,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import { flyRegions } from "@openstatus/db/src/schema/constants";

import { appRouter } from "../root";
import { createInnerTRPCContext } from "../trpc";

/**
 * Sync Tests: Verify that mutations to legacy tables also sync to new page_component tables
 *
 * Table mappings:
 * - monitor_group -> page_component_groups
 * - monitors_to_pages -> page_component
 * - status_report_to_monitors -> status_report_to_page_component
 * - maintenance_to_monitor -> maintenance_to_page_component
 */

function getTestContext(limits?: unknown) {
  return createInnerTRPCContext({
    req: undefined,
    session: {
      user: {
        id: "1",
      },
    },
    workspace: {
      id: 1,
      // @ts-expect-error - test context with partial limits
      limits: limits || {
        monitors: 100,
        periodicity: ["30s", "1m", "5m", "10m", "30m", "1h"],
        regions: flyRegions,
        "status-pages": 10,
        maintenance: true,
        notifications: 10,
        "status-subscribers": true,
        sms: false,
        pagerduty: true,
        "password-protection": true,
        "email-domain-protection": true,
        "custom-domain": true,
      },
    },
  });
}

// Test data identifiers
const TEST_PREFIX = "sync-test";
let testPageId: number;
let testMonitorId: number;

const monitorData = {
  name: `${TEST_PREFIX}-monitor`,
  url: "https://sync-test.example.com",
  jobType: "http" as const,
  method: "GET" as const,
  periodicity: "1m" as const,
  regions: [flyRegions[0]],
  statusAssertions: [],
  headerAssertions: [],
  textBodyAssertions: [],
  notifications: [],
  pages: [] as number[],
  tags: [],
};

beforeAll(async () => {
  // Clean up any existing test data
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-monitor`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-page`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));
  await db
    .delete(monitor)
    .where(eq(monitor.name, `${TEST_PREFIX}-deletable-monitor`));

  // Create test page first
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: "Sync Test Page",
      description: "A test page for sync tests",
      slug: `${TEST_PREFIX}-page`,
      customDomain: "",
    })
    .returning()
    .get();
  testPageId = testPage.id;

  // Create test monitor using tRPC
  const ctx = getTestContext();
  const caller = appRouter.createCaller(ctx);
  const createdMonitor = await caller.monitor.create(monitorData);
  testMonitorId = createdMonitor.id;
});

afterAll(async () => {
  // Clean up test data in correct order (dependencies first)
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
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.pageId, testPageId));
  await db.delete(monitorGroup).where(eq(monitorGroup.pageId, testPageId));
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
  await db
    .delete(monitor)
    .where(eq(monitor.name, `${TEST_PREFIX}-deletable-monitor`));
});

describe("Sync: monitors_to_pages -> page_component", () => {
  test("Creating monitor-to-page relation syncs to page_component", async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // Update monitor to add it to the test page
    await caller.monitor.update({
      ...monitorData,
      id: testMonitorId,
      pages: [testPageId],
    });

    // Verify monitors_to_pages was created
    const monitorToPage = await db.query.monitorsToPages.findFirst({
      where: and(
        eq(monitorsToPages.monitorId, testMonitorId),
        eq(monitorsToPages.pageId, testPageId),
      ),
    });
    expect(monitorToPage).toBeDefined();

    // Verify page_component was synced
    const component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, testPageId),
      ),
    });
    expect(component).toBeDefined();
    expect(component?.type).toBe("monitor");
    expect(component?.workspaceId).toBe(1);
  });

  test("Removing monitor-to-page relation syncs delete to page_component", async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // First add the monitor to page if not already
    await caller.monitor.update({
      ...monitorData,
      id: testMonitorId,
      pages: [testPageId],
    });

    // Verify page_component exists
    let component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, testPageId),
      ),
    });
    expect(component).toBeDefined();

    // Remove monitor from page
    await caller.monitor.update({
      ...monitorData,
      id: testMonitorId,
      pages: [],
    });

    // Verify page_component was deleted
    component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, testPageId),
      ),
    });
    expect(component).toBeUndefined();
  });
});

describe("Sync: page.updateMonitors -> page_component and page_component_groups", () => {
  test("Adding monitors with groups syncs to page_component and page_component_groups", async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // Update page with monitor in a group
    await caller.page.updateMonitors({
      id: testPageId,
      monitors: [],
      groups: [
        {
          name: `${TEST_PREFIX}-group`,
          order: 0,
          monitors: [{ id: testMonitorId, order: 0 }],
        },
      ],
    });

    // Verify monitor_group was created
    const group = await db.query.monitorGroup.findFirst({
      where: and(
        eq(monitorGroup.pageId, testPageId),
        eq(monitorGroup.name, `${TEST_PREFIX}-group`),
      ),
    });
    expect(group).toBeDefined();

    if (!group) {
      throw new Error("Group not found");
    }

    // Verify page_component_groups was synced
    const componentGroup = await db.query.pageComponentGroup.findFirst({
      where: eq(pageComponentGroup.id, group.id),
    });
    expect(componentGroup).toBeDefined();
    expect(componentGroup?.name).toBe(`${TEST_PREFIX}-group`);
    expect(componentGroup?.pageId).toBe(testPageId);

    // Verify page_component was synced with group reference
    const component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, testPageId),
      ),
    });
    expect(component).toBeDefined();
    expect(component?.groupId).toBe(group.id);
  });

  test("Updating page monitors syncs changes to page_component", async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // First, set up with a group
    await caller.page.updateMonitors({
      id: testPageId,
      monitors: [],
      groups: [
        {
          name: `${TEST_PREFIX}-group`,
          order: 0,
          monitors: [{ id: testMonitorId, order: 0 }],
        },
      ],
    });

    // Now update to remove the group and add monitor directly
    await caller.page.updateMonitors({
      id: testPageId,
      monitors: [{ id: testMonitorId, order: 0 }],
      groups: [],
    });

    // Verify monitor_group was deleted
    const group = await db.query.monitorGroup.findFirst({
      where: and(
        eq(monitorGroup.pageId, testPageId),
        eq(monitorGroup.name, `${TEST_PREFIX}-group`),
      ),
    });
    expect(group).toBeUndefined();

    // Verify page_component still exists but without group
    const component = await db.query.pageComponent.findFirst({
      where: and(
        eq(pageComponent.monitorId, testMonitorId),
        eq(pageComponent.pageId, testPageId),
      ),
    });
    expect(component).toBeDefined();
    expect(component?.groupId).toBeNull();
  });
});

describe("Sync: maintenance_to_monitor -> maintenance_to_page_component", () => {
  let testMaintenanceId: number;

  beforeAll(async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // Ensure monitor is on the page first
    await caller.monitor.update({
      ...monitorData,
      id: testMonitorId,
      pages: [testPageId],
    });
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

  test("Creating maintenance with monitors syncs to maintenance_to_page_component", async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    const from = new Date();
    const to = new Date(from.getTime() + 1000 * 60 * 60);

    const createdMaintenance = await caller.maintenance.new({
      title: `${TEST_PREFIX} Maintenance`,
      message: "Test maintenance for sync",
      startDate: from,
      endDate: to,
      pageId: testPageId,
      monitors: [testMonitorId],
    });
    testMaintenanceId = createdMaintenance.id;

    // Verify maintenance_to_monitor was created
    const maintenanceToMonitor =
      await db.query.maintenancesToMonitors.findFirst({
        where: and(
          eq(maintenancesToMonitors.maintenanceId, testMaintenanceId),
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
            eq(maintenancesToPageComponents.maintenanceId, testMaintenanceId),
            eq(maintenancesToPageComponents.pageComponentId, component.id),
          ),
        });
      expect(maintenanceToComponent).toBeDefined();
    }
  });

  test("Updating maintenance monitors syncs to maintenance_to_page_component", async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // Skip if no maintenance was created
    if (!testMaintenanceId) return;

    const from = new Date();
    const to = new Date(from.getTime() + 1000 * 60 * 60);

    // Update maintenance to remove monitors
    await caller.maintenance.update({
      id: testMaintenanceId,
      title: `${TEST_PREFIX} Maintenance`,
      message: "Updated maintenance",
      startDate: from,
      endDate: to,
      monitors: [],
    });

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

describe("Sync: status_report_to_monitors -> status_report_to_page_component", () => {
  let testStatusReportId: number;

  beforeAll(async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // Ensure monitor is on the page first
    await caller.monitor.update({
      ...monitorData,
      id: testMonitorId,
      pages: [testPageId],
    });
  });

  afterAll(async () => {
    if (testStatusReportId) {
      await db
        .delete(statusReportsToPageComponents)
        .where(
          eq(statusReportsToPageComponents.statusReportId, testStatusReportId),
        );
      await db
        .delete(monitorsToStatusReport)
        .where(eq(monitorsToStatusReport.statusReportId, testStatusReportId));
      await db
        .delete(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, testStatusReportId));
      await db
        .delete(statusReport)
        .where(eq(statusReport.id, testStatusReportId));
    }
  });

  test("Creating status report with monitors syncs to status_report_to_page_component", async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    const createdReport = await caller.statusReport.create({
      title: `${TEST_PREFIX} Status Report`,
      status: "investigating",
      message: "Test status report for sync",
      pageId: testPageId,
      monitors: [testMonitorId],
      date: new Date(),
    });
    testStatusReportId = createdReport.statusReportId;

    // Verify status_report_to_monitors was created
    const reportToMonitor = await db.query.monitorsToStatusReport.findFirst({
      where: and(
        eq(monitorsToStatusReport.statusReportId, testStatusReportId),
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
              testStatusReportId,
            ),
            eq(statusReportsToPageComponents.pageComponentId, component.id),
          ),
        });
      expect(reportToComponent).toBeDefined();
    }
  });

  test("Updating status report monitors syncs to status_report_to_page_component", async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // Skip if no status report was created
    if (!testStatusReportId) return;

    // Update status to remove monitors (using updateStatus procedure)
    await caller.statusReport.updateStatus({
      id: testStatusReportId,
      status: "resolved",
      monitors: [],
      title: `${TEST_PREFIX} Status Report`,
    });

    // Verify status_report_to_monitors was deleted
    const reportToMonitor = await db.query.monitorsToStatusReport.findFirst({
      where: and(
        eq(monitorsToStatusReport.statusReportId, testStatusReportId),
        eq(monitorsToStatusReport.monitorId, testMonitorId),
      ),
    });
    expect(reportToMonitor).toBeUndefined();

    // Verify status_report_to_page_component was also deleted
    const reportToComponent =
      await db.query.statusReportsToPageComponents.findFirst({
        where: eq(
          statusReportsToPageComponents.statusReportId,
          testStatusReportId,
        ),
      });
    expect(reportToComponent).toBeUndefined();
  });
});

describe("Sync: monitor deletion cascades to page_component tables", () => {
  let deletableMonitorId: number;

  beforeAll(async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create a monitor specifically for deletion tests
    const deletableMonitor = await caller.monitor.create({
      ...monitorData,
      name: `${TEST_PREFIX}-deletable-monitor`,
      url: "https://delete-test.example.com",
      pages: [testPageId],
    });
    deletableMonitorId = deletableMonitor.id;
  });

  test("Deleting monitor removes related page_component entries", async () => {
    const ctx = getTestContext();
    const caller = appRouter.createCaller(ctx);

    // Verify page_component exists before deletion
    let component = await db.query.pageComponent.findFirst({
      where: eq(pageComponent.monitorId, deletableMonitorId),
    });
    expect(component).toBeDefined();

    // Delete the monitor
    await caller.monitor.delete({ id: deletableMonitorId });

    // Verify page_component was removed
    component = await db.query.pageComponent.findFirst({
      where: eq(pageComponent.monitorId, deletableMonitorId),
    });
    expect(component).toBeUndefined();
  });
});
