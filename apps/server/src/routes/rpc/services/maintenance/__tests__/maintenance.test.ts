import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
  pageComponent,
  pageSubscription,
} from "@openstatus/db/src/schema";

// Mock the dispatcher function before importing app
mock.module("@openstatus/subscriptions", () => ({
  dispatchPageUpdate: mock(() => Promise.resolve()),
  dispatchMaintenanceUpdate: mock(() => Promise.resolve()),
  dispatchStatusReportUpdate: mock(() => Promise.resolve()),
  getChannel: mock(),
}));

import { app } from "@/index";
import { dispatchMaintenanceUpdate } from "@openstatus/subscriptions";

// Get reference to the mock
const dispatchMaintenanceUpdateMock = dispatchMaintenanceUpdate as ReturnType<
  typeof mock
>;

/**
 * Helper to make ConnectRPC requests using the Connect protocol (JSON).
 * Connect uses POST with JSON body at /rpc/<service>/<method>
 */
async function connectRequest(
  method: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return app.request(
    `/rpc/openstatus.maintenance.v1.MaintenanceService/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

const TEST_PREFIX = "rpc-maintenance-test";
let testPageComponentId: number;
let testMaintenanceId: number;
let testMaintenanceToDeleteId: number;
let testMaintenanceToUpdateId: number;
let testMaintenanceForNotifyId: number;
let testSubscriberId: number;
// For mixed-page validation tests
let testPage2Id: number;
let testPage2ComponentId: number;

beforeAll(async () => {
  // Clean up any existing test data
  await db
    .delete(maintenance)
    .where(eq(maintenance.title, `${TEST_PREFIX}-main`));
  await db
    .delete(maintenance)
    .where(eq(maintenance.title, `${TEST_PREFIX}-to-delete`));
  await db
    .delete(maintenance)
    .where(eq(maintenance.title, `${TEST_PREFIX}-to-update`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));

  // Create a test page component (using existing page 1 from seed)
  const component = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: 1,
      type: "static",
      name: `${TEST_PREFIX}-component`,
      description: "Test component for maintenance tests",
      order: 100,
    })
    .returning()
    .get();
  testPageComponentId = component.id;

  // Create a second page and component for mixed-page validation tests
  const page2 = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-page-2`,
      slug: `${TEST_PREFIX}-page-2-slug`,
      description: "Second test page for mixed-page tests",
      customDomain: "",
    })
    .returning()
    .get();
  testPage2Id = page2.id;

  const component2 = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: testPage2Id,
      type: "static",
      name: `${TEST_PREFIX}-component-2`,
      description: "Test component on page 2",
      order: 100,
    })
    .returning()
    .get();
  testPage2ComponentId = component2.id;

  // Create test maintenance
  const maintenanceRecord = await db
    .insert(maintenance)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-main`,
      message: "Test maintenance message",
      from: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
      to: new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 hours from now
    })
    .returning()
    .get();
  testMaintenanceId = maintenanceRecord.id;

  // Create page component association
  await db.insert(maintenancesToPageComponents).values({
    maintenanceId: maintenanceRecord.id,
    pageComponentId: testPageComponentId,
  });

  // Create maintenance to delete
  const deleteRecord = await db
    .insert(maintenance)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-to-delete`,
      message: "Maintenance to delete",
      from: new Date(Date.now() + 48 * 60 * 60 * 1000),
      to: new Date(Date.now() + 49 * 60 * 60 * 1000),
    })
    .returning()
    .get();
  testMaintenanceToDeleteId = deleteRecord.id;

  // Create maintenance to update
  const updateRecord = await db
    .insert(maintenance)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-to-update`,
      message: "Maintenance to update",
      from: new Date(Date.now() + 72 * 60 * 60 * 1000),
      to: new Date(Date.now() + 73 * 60 * 60 * 1000),
    })
    .returning()
    .get();
  testMaintenanceToUpdateId = updateRecord.id;

  await db.insert(maintenancesToPageComponents).values({
    maintenanceId: updateRecord.id,
    pageComponentId: testPageComponentId,
  });

  // Create maintenance for notify tests
  const notifyRecord = await db
    .insert(maintenance)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-for-notify`,
      message: "Maintenance for notify tests",
      from: new Date(Date.now() + 96 * 60 * 60 * 1000),
      to: new Date(Date.now() + 97 * 60 * 60 * 1000),
    })
    .returning()
    .get();
  testMaintenanceForNotifyId = notifyRecord.id;

  await db.insert(maintenancesToPageComponents).values({
    maintenanceId: notifyRecord.id,
    pageComponentId: testPageComponentId,
  });

  // Create a verified subscription for notification tests
  const subscriber = await db
    .insert(pageSubscription)
    .values({
      pageId: 1,
      workspaceId: 1,
      channelType: "email",
      email: `${TEST_PREFIX}@example.com`,
      webhookUrl: null,
      token: `${TEST_PREFIX}-token`,
      verifiedAt: new Date(),
    })
    .returning()
    .get();
  testSubscriberId = subscriber.id;
});

afterAll(async () => {
  // Clean up subscription first (only if it was created)
  if (testSubscriberId) {
    await db
      .delete(pageSubscription)
      .where(eq(pageSubscription.id, testSubscriberId));
  }

  // Clean up associations
  await db
    .delete(maintenancesToPageComponents)
    .where(eq(maintenancesToPageComponents.maintenanceId, testMaintenanceId));
  await db
    .delete(maintenancesToPageComponents)
    .where(
      eq(maintenancesToPageComponents.maintenanceId, testMaintenanceToUpdateId),
    );
  await db
    .delete(maintenancesToPageComponents)
    .where(
      eq(
        maintenancesToPageComponents.maintenanceId,
        testMaintenanceForNotifyId,
      ),
    );

  // Clean up maintenances
  await db
    .delete(maintenance)
    .where(eq(maintenance.title, `${TEST_PREFIX}-main`));
  await db
    .delete(maintenance)
    .where(eq(maintenance.title, `${TEST_PREFIX}-to-delete`));
  await db
    .delete(maintenance)
    .where(eq(maintenance.title, `${TEST_PREFIX}-to-update`));
  await db
    .delete(maintenance)
    .where(eq(maintenance.title, `${TEST_PREFIX}-for-notify`));

  // Clean up page component
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));

  // Clean up second page component and page (for mixed-page tests)
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component-2`));
  await db.delete(page).where(eq(page.title, `${TEST_PREFIX}-page-2`));
});

describe("MaintenanceService.CreateMaintenance", () => {
  test("creates a new maintenance", async () => {
    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-created`,
        message: "Scheduled maintenance for system upgrade.",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: "1",
        pageComponentIds: [String(testPageComponentId)],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("maintenance");
    expect(data.maintenance.title).toBe(`${TEST_PREFIX}-created`);
    expect(data.maintenance.message).toBe(
      "Scheduled maintenance for system upgrade.",
    );
    expect(data.maintenance.pageComponentIds).toContain(
      String(testPageComponentId),
    );

    // Clean up
    await db
      .delete(maintenancesToPageComponents)
      .where(
        eq(
          maintenancesToPageComponents.maintenanceId,
          Number(data.maintenance.id),
        ),
      );
    await db
      .delete(maintenance)
      .where(eq(maintenance.id, Number(data.maintenance.id)));
  });

  test("returns 401 when no auth key provided", async () => {
    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest("CreateMaintenance", {
      title: "Unauthorized test",
      message: "Test message",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      pageId: "1",
      pageComponentIds: ["1"],
    });

    expect(res.status).toBe(401);
  });

  test("returns error for invalid page component ID", async () => {
    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: "Invalid component test",
        message: "Test message",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: "1",
        pageComponentIds: ["99999"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when page components are from different pages", async () => {
    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-mixed-pages`,
        message: "Test message",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: "1",
        pageComponentIds: [
          String(testPageComponentId),
          String(testPage2ComponentId),
        ],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain(
      "All page components must belong to the same page",
    );
  });

  test("returns error when pageId does not match components page", async () => {
    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-pageid-mismatch`,
        message: "Test pageId mismatch with components.",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: "1", // This doesn't match testPage2ComponentId's page
        pageComponentIds: [String(testPage2ComponentId)],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("does not match the page ID");
  });

  test("creates maintenance when pageId matches component page", async () => {
    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-matching-pageid`,
        message: "Test with matching pageId and components.",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: String(testPage2Id), // Matching the component's page
        pageComponentIds: [String(testPage2ComponentId)],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("maintenance");
    expect(data.maintenance.pageComponentIds).toContain(
      String(testPage2ComponentId),
    );

    // Verify the pageId was set correctly
    const createdRecord = await db
      .select()
      .from(maintenance)
      .where(eq(maintenance.id, Number(data.maintenance.id)))
      .get();
    expect(createdRecord?.pageId).toBe(testPage2Id);

    // Clean up
    await db
      .delete(maintenancesToPageComponents)
      .where(
        eq(
          maintenancesToPageComponents.maintenanceId,
          Number(data.maintenance.id),
        ),
      );
    await db
      .delete(maintenance)
      .where(eq(maintenance.id, Number(data.maintenance.id)));
  });

  test("creates maintenance with empty pageComponentIds", async () => {
    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-no-components`,
        message: "Maintenance without components.",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: "1",
        pageComponentIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("maintenance");
    expect(data.maintenance.title).toBe(`${TEST_PREFIX}-no-components`);
    const pageComponentIds = data.maintenance.pageComponentIds ?? [];
    expect(pageComponentIds).toHaveLength(0);

    // Clean up
    await db
      .delete(maintenance)
      .where(eq(maintenance.id, Number(data.maintenance.id)));
  });

  test("creates maintenance with notify=true", async () => {
    dispatchMaintenanceUpdateMock.mockClear();

    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-with-notify`,
        message: "Notifying subscribers about this maintenance.",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: "1",
        pageComponentIds: [String(testPageComponentId)],
        notify: true,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("maintenance");
    expect(data.maintenance.title).toBe(`${TEST_PREFIX}-with-notify`);

    // Verify notification was dispatched with maintenance ID
    expect(dispatchMaintenanceUpdateMock).toHaveBeenCalledTimes(1);
    const maintenanceId = dispatchMaintenanceUpdateMock.mock.calls[0][0];
    expect(maintenanceId).toBe(Number(data.maintenance.id));

    // Clean up
    await db
      .delete(maintenancesToPageComponents)
      .where(
        eq(
          maintenancesToPageComponents.maintenanceId,
          Number(data.maintenance.id),
        ),
      );
    await db
      .delete(maintenance)
      .where(eq(maintenance.id, Number(data.maintenance.id)));
  });

  test("creates maintenance with notify=false (default)", async () => {
    dispatchMaintenanceUpdateMock.mockClear();

    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-no-notify`,
        message: "No notification for this one.",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: "1",
        pageComponentIds: [],
        notify: false,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("maintenance");
    expect(data.maintenance.title).toBe(`${TEST_PREFIX}-no-notify`);

    // Verify notification was NOT dispatched
    expect(dispatchMaintenanceUpdateMock).not.toHaveBeenCalled();

    // Clean up
    await db
      .delete(maintenance)
      .where(eq(maintenance.id, Number(data.maintenance.id)));
  });

  test("returns error for invalid date format", async () => {
    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-invalid-date`,
        message: "Test with invalid date.",
        from: "not-a-valid-date",
        to: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000,
        ).toISOString(),
        pageId: "1",
        pageComponentIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("from: value does not match regex pattern");
  });

  test("returns error when from date is after to date", async () => {
    const fromDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8 days from now
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now (before from)

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-invalid-range`,
        message: "Test with invalid date range.",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: "1",
        pageComponentIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Start time (from) must be before end time");
  });

  test("returns error for non-existent page", async () => {
    const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const toDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600000);

    const res = await connectRequest(
      "CreateMaintenance",
      {
        title: `${TEST_PREFIX}-invalid-page`,
        message: "Test with non-existent page.",
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        pageId: "99999",
        pageComponentIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.message).toContain("Page not found");
  });
});

describe("MaintenanceService.GetMaintenance", () => {
  test("returns maintenance with page components", async () => {
    const res = await connectRequest(
      "GetMaintenance",
      { id: String(testMaintenanceId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("maintenance");
    expect(data.maintenance.id).toBe(String(testMaintenanceId));
    expect(data.maintenance.title).toBe(`${TEST_PREFIX}-main`);
    expect(data.maintenance.pageComponentIds).toContain(
      String(testPageComponentId),
    );
    expect(data.maintenance).toHaveProperty("createdAt");
    expect(data.maintenance).toHaveProperty("updatedAt");
    expect(data.maintenance).toHaveProperty("from");
    expect(data.maintenance).toHaveProperty("to");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("GetMaintenance", {
      id: String(testMaintenanceId),
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent maintenance", async () => {
    const res = await connectRequest(
      "GetMaintenance",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns 404 for maintenance in different workspace", async () => {
    // Create maintenance in workspace 2
    const otherRecord = await db
      .insert(maintenance)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace`,
        message: "Other workspace maintenance",
        from: new Date(Date.now() + 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 25 * 60 * 60 * 1000),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "GetMaintenance",
        { id: String(otherRecord.id) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);
    } finally {
      await db.delete(maintenance).where(eq(maintenance.id, otherRecord.id));
    }
  });

  test("returns error when ID is empty string", async () => {
    const res = await connectRequest(
      "GetMaintenance",
      { id: "" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns error when ID is whitespace only", async () => {
    const res = await connectRequest(
      "GetMaintenance",
      { id: "   " },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });
});

describe("MaintenanceService.ListMaintenances", () => {
  test("returns maintenances for authenticated workspace", async () => {
    const res = await connectRequest(
      "ListMaintenances",
      {},
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("maintenances");
    expect(Array.isArray(data.maintenances)).toBe(true);
    expect(data).toHaveProperty("totalSize");
  });

  test("returns maintenances with correct structure (summary)", async () => {
    const res = await connectRequest(
      "ListMaintenances",
      { limit: 100 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const record = data.maintenances?.find(
      (m: { id: string }) => m.id === String(testMaintenanceId),
    );

    expect(record).toBeDefined();
    expect(record.title).toBe(`${TEST_PREFIX}-main`);
    expect(record.pageComponentIds).toBeDefined();
    expect(record.createdAt).toBeDefined();
    expect(record.updatedAt).toBeDefined();
    expect(record.from).toBeDefined();
    expect(record.to).toBeDefined();
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("ListMaintenances", {});

    expect(res.status).toBe(401);
  });

  test("respects limit parameter", async () => {
    const res = await connectRequest(
      "ListMaintenances",
      { limit: 1 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.maintenances?.length || 0).toBeLessThanOrEqual(1);
  });

  test("respects offset parameter", async () => {
    // Get total count first
    const res1 = await connectRequest(
      "ListMaintenances",
      {},
      { "x-openstatus-key": "1" },
    );
    const data1 = await res1.json();
    const totalSize = data1.totalSize;

    if (totalSize > 1) {
      // Get first page
      const res2 = await connectRequest(
        "ListMaintenances",
        { limit: 1, offset: 0 },
        { "x-openstatus-key": "1" },
      );
      const data2 = await res2.json();

      // Get second page
      const res3 = await connectRequest(
        "ListMaintenances",
        { limit: 1, offset: 1 },
        { "x-openstatus-key": "1" },
      );
      const data3 = await res3.json();

      // Should have different maintenances
      if (data2.maintenances?.length > 0 && data3.maintenances?.length > 0) {
        expect(data2.maintenances[0].id).not.toBe(data3.maintenances[0].id);
      }
    }
  });

  test("filters by page_id", async () => {
    const res = await connectRequest(
      "ListMaintenances",
      { pageId: "1" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    // All returned maintenances should have pageId 1
    for (const record of data.maintenances || []) {
      expect(record.pageId).toBe("1");
    }
  });

  test("only returns maintenances for authenticated workspace", async () => {
    // Create maintenance in workspace 2
    const otherRecord = await db
      .insert(maintenance)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace-list`,
        message: "Other workspace maintenance",
        from: new Date(Date.now() + 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 25 * 60 * 60 * 1000),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "ListMaintenances",
        { limit: 100 },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      const recordIds = (data.maintenances || []).map(
        (m: { id: string }) => m.id,
      );

      expect(recordIds).not.toContain(String(otherRecord.id));
    } finally {
      await db.delete(maintenance).where(eq(maintenance.id, otherRecord.id));
    }
  });
});

describe("MaintenanceService.UpdateMaintenance", () => {
  test("updates maintenance title", async () => {
    const res = await connectRequest(
      "UpdateMaintenance",
      {
        id: String(testMaintenanceToUpdateId),
        title: `${TEST_PREFIX}-updated-title`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("maintenance");
    expect(data.maintenance.title).toBe(`${TEST_PREFIX}-updated-title`);

    // Restore original title
    await db
      .update(maintenance)
      .set({ title: `${TEST_PREFIX}-to-update` })
      .where(eq(maintenance.id, testMaintenanceToUpdateId));
  });

  test("updates maintenance message", async () => {
    const res = await connectRequest(
      "UpdateMaintenance",
      {
        id: String(testMaintenanceToUpdateId),
        message: "Updated maintenance message",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.maintenance.message).toBe("Updated maintenance message");

    // Restore original message
    await db
      .update(maintenance)
      .set({ message: "Maintenance to update" })
      .where(eq(maintenance.id, testMaintenanceToUpdateId));
  });

  test("updates page component associations", async () => {
    // Use existing seeded page component 1
    const res = await connectRequest(
      "UpdateMaintenance",
      {
        id: String(testMaintenanceToUpdateId),
        pageComponentIds: ["1"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.maintenance.pageComponentIds).toContain("1");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("UpdateMaintenance", {
      id: String(testMaintenanceToUpdateId),
      title: "Unauthorized update",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent maintenance", async () => {
    const res = await connectRequest(
      "UpdateMaintenance",
      { id: "99999", title: "Non-existent update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when ID is empty string", async () => {
    const res = await connectRequest(
      "UpdateMaintenance",
      { id: "", title: "Empty ID update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns error when ID is whitespace only", async () => {
    const res = await connectRequest(
      "UpdateMaintenance",
      { id: "   ", title: "Whitespace ID update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for maintenance in different workspace", async () => {
    // Create maintenance in workspace 2
    const otherRecord = await db
      .insert(maintenance)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace-update`,
        message: "Other workspace maintenance",
        from: new Date(Date.now() + 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 25 * 60 * 60 * 1000),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "UpdateMaintenance",
        { id: String(otherRecord.id), title: "Should not update" },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);
    } finally {
      await db.delete(maintenance).where(eq(maintenance.id, otherRecord.id));
    }
  });

  test("returns error for invalid page component ID on update", async () => {
    const res = await connectRequest(
      "UpdateMaintenance",
      {
        id: String(testMaintenanceToUpdateId),
        pageComponentIds: ["99999"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when updating with components from different pages", async () => {
    const res = await connectRequest(
      "UpdateMaintenance",
      {
        id: String(testMaintenanceToUpdateId),
        pageComponentIds: [
          String(testPageComponentId),
          String(testPage2ComponentId),
        ],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain(
      "All page components must belong to the same page",
    );
  });

  test("validates date range on update", async () => {
    // Try to update with from > to
    const record = await db
      .select()
      .from(maintenance)
      .where(eq(maintenance.id, testMaintenanceToUpdateId))
      .get();

    const newFrom = new Date(record?.to?.getTime() ?? Date.now() + 86400000);

    const res = await connectRequest(
      "UpdateMaintenance",
      {
        id: String(testMaintenanceToUpdateId),
        from: newFrom.toISOString(),
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Start time (from) must be before end time");
  });
});

describe("MaintenanceService.DeleteMaintenance", () => {
  test("successfully deletes existing maintenance", async () => {
    const res = await connectRequest(
      "DeleteMaintenance",
      { id: String(testMaintenanceToDeleteId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify it's deleted
    const deleted = await db
      .select()
      .from(maintenance)
      .where(eq(maintenance.id, testMaintenanceToDeleteId))
      .get();
    expect(deleted).toBeUndefined();
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("DeleteMaintenance", { id: "1" });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent maintenance", async () => {
    const res = await connectRequest(
      "DeleteMaintenance",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when ID is empty string", async () => {
    const res = await connectRequest(
      "DeleteMaintenance",
      { id: "" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns error when ID is whitespace only", async () => {
    const res = await connectRequest(
      "DeleteMaintenance",
      { id: "   " },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for maintenance in different workspace", async () => {
    // Create maintenance in workspace 2
    const otherRecord = await db
      .insert(maintenance)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace-delete`,
        message: "Other workspace maintenance",
        from: new Date(Date.now() + 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 25 * 60 * 60 * 1000),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "DeleteMaintenance",
        { id: String(otherRecord.id) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);

      // Verify it wasn't deleted
      const stillExists = await db
        .select()
        .from(maintenance)
        .where(eq(maintenance.id, otherRecord.id))
        .get();
      expect(stillExists).toBeDefined();
    } finally {
      await db.delete(maintenance).where(eq(maintenance.id, otherRecord.id));
    }
  });
});
