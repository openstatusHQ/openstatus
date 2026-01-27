import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { app } from "@/index";

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
    `/rpc/openstatus.status_report.v1.StatusReportService/${method}`,
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

const TEST_PREFIX = "rpc-status-report-test";
let testPageComponentId: number;
let testStatusReportId: number;
let testStatusReportToDeleteId: number;
let testStatusReportToUpdateId: number;

beforeAll(async () => {
  // Clean up any existing test data
  await db
    .delete(statusReport)
    .where(eq(statusReport.title, `${TEST_PREFIX}-main`));
  await db
    .delete(statusReport)
    .where(eq(statusReport.title, `${TEST_PREFIX}-to-delete`));
  await db
    .delete(statusReport)
    .where(eq(statusReport.title, `${TEST_PREFIX}-to-update`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));

  // Create a test page component (using existing page 1 from seed)
  const component = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: 1,
      type: "external",
      name: `${TEST_PREFIX}-component`,
      description: "Test component for status report tests",
      order: 100,
    })
    .returning()
    .get();
  testPageComponentId = component.id;

  // Create test status report
  const report = await db
    .insert(statusReport)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-main`,
      status: "investigating",
    })
    .returning()
    .get();
  testStatusReportId = report.id;

  // Create page component association
  await db.insert(statusReportsToPageComponents).values({
    statusReportId: report.id,
    pageComponentId: testPageComponentId,
  });

  // Create status report updates
  await db.insert(statusReportUpdate).values([
    {
      statusReportId: report.id,
      status: "investigating",
      date: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      message: "We are investigating the issue.",
    },
    {
      statusReportId: report.id,
      status: "identified",
      date: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      message: "We have identified the root cause.",
    },
  ]);

  // Create status report to delete
  const deleteReport = await db
    .insert(statusReport)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-to-delete`,
      status: "investigating",
    })
    .returning()
    .get();
  testStatusReportToDeleteId = deleteReport.id;

  // Create status report to update
  const updateReport = await db
    .insert(statusReport)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-to-update`,
      status: "investigating",
    })
    .returning()
    .get();
  testStatusReportToUpdateId = updateReport.id;

  await db.insert(statusReportsToPageComponents).values({
    statusReportId: updateReport.id,
    pageComponentId: testPageComponentId,
  });
});

afterAll(async () => {
  // Clean up status report updates first (due to foreign key)
  await db
    .delete(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, testStatusReportId));
  await db
    .delete(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, testStatusReportToUpdateId));

  // Clean up associations
  await db
    .delete(statusReportsToPageComponents)
    .where(
      eq(statusReportsToPageComponents.statusReportId, testStatusReportId),
    );
  await db
    .delete(statusReportsToPageComponents)
    .where(
      eq(
        statusReportsToPageComponents.statusReportId,
        testStatusReportToUpdateId,
      ),
    );

  // Clean up status reports
  await db
    .delete(statusReport)
    .where(eq(statusReport.title, `${TEST_PREFIX}-main`));
  await db
    .delete(statusReport)
    .where(eq(statusReport.title, `${TEST_PREFIX}-to-delete`));
  await db
    .delete(statusReport)
    .where(eq(statusReport.title, `${TEST_PREFIX}-to-update`));

  // Clean up page component
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));
});

describe("StatusReportService.CreateStatusReport", () => {
  test("creates a new status report with initial update", async () => {
    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX}-created`,
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "We are looking into this issue.",
        date: new Date().toISOString(),
        pageComponentIds: [String(testPageComponentId)],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.title).toBe(`${TEST_PREFIX}-created`);
    expect(data.statusReport.status).toBe("STATUS_REPORT_STATUS_INVESTIGATING");
    expect(data.statusReport.pageComponentIds).toContain(
      String(testPageComponentId),
    );
    expect(data.statusReport.updates).toHaveLength(1);
    expect(data.statusReport.updates[0].message).toBe(
      "We are looking into this issue.",
    );

    // Clean up
    await db
      .delete(statusReportUpdate)
      .where(
        eq(statusReportUpdate.statusReportId, Number(data.statusReport.id)),
      );
    await db
      .delete(statusReportsToPageComponents)
      .where(
        eq(
          statusReportsToPageComponents.statusReportId,
          Number(data.statusReport.id),
        ),
      );
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, Number(data.statusReport.id)));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("CreateStatusReport", {
      title: "Unauthorized test",
      status: "STATUS_REPORT_STATUS_INVESTIGATING",
      message: "Test message",
      date: new Date().toISOString(),
      pageComponentIds: ["1"],
    });

    expect(res.status).toBe(401);
  });

  test("returns error for invalid page component ID", async () => {
    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: "Invalid component test",
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "Test message",
        date: new Date().toISOString(),
        pageComponentIds: ["99999"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

describe("StatusReportService.GetStatusReport", () => {
  test("returns status report with updates", async () => {
    const res = await connectRequest(
      "GetStatusReport",
      { id: String(testStatusReportId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.id).toBe(String(testStatusReportId));
    expect(data.statusReport.title).toBe(`${TEST_PREFIX}-main`);
    expect(data.statusReport.pageComponentIds).toContain(
      String(testPageComponentId),
    );
    expect(data.statusReport.updates).toHaveLength(2);
    expect(data.statusReport).toHaveProperty("createdAt");
    expect(data.statusReport).toHaveProperty("updatedAt");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("GetStatusReport", {
      id: String(testStatusReportId),
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent status report", async () => {
    const res = await connectRequest(
      "GetStatusReport",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns 404 for status report in different workspace", async () => {
    // Create status report in workspace 2
    const otherReport = await db
      .insert(statusReport)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace`,
        status: "investigating",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "GetStatusReport",
        { id: String(otherReport.id) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);
    } finally {
      await db.delete(statusReport).where(eq(statusReport.id, otherReport.id));
    }
  });
});

describe("StatusReportService.ListStatusReports", () => {
  test("returns status reports for authenticated workspace", async () => {
    const res = await connectRequest(
      "ListStatusReports",
      {},
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReports");
    expect(Array.isArray(data.statusReports)).toBe(true);
    expect(data).toHaveProperty("totalSize");
  });

  test("returns status reports with correct structure (summary only)", async () => {
    const res = await connectRequest(
      "ListStatusReports",
      { limit: 100 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    const report = data.statusReports?.find(
      (r: { id: string }) => r.id === String(testStatusReportId),
    );

    expect(report).toBeDefined();
    expect(report.title).toBe(`${TEST_PREFIX}-main`);
    expect(report.pageComponentIds).toBeDefined();
    expect(report.createdAt).toBeDefined();
    expect(report.updatedAt).toBeDefined();
    // Summary should NOT include updates
    expect(report.updates).toBeUndefined();
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("ListStatusReports", {});

    expect(res.status).toBe(401);
  });

  test("respects limit parameter", async () => {
    const res = await connectRequest(
      "ListStatusReports",
      { limit: 1 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusReports?.length || 0).toBeLessThanOrEqual(1);
  });

  test("respects offset parameter", async () => {
    // Get total count first
    const res1 = await connectRequest(
      "ListStatusReports",
      {},
      { "x-openstatus-key": "1" },
    );
    const data1 = await res1.json();
    const totalSize = data1.totalSize;

    if (totalSize > 1) {
      // Get first page
      const res2 = await connectRequest(
        "ListStatusReports",
        { limit: 1, offset: 0 },
        { "x-openstatus-key": "1" },
      );
      const data2 = await res2.json();

      // Get second page
      const res3 = await connectRequest(
        "ListStatusReports",
        { limit: 1, offset: 1 },
        { "x-openstatus-key": "1" },
      );
      const data3 = await res3.json();

      // Should have different reports
      if (data2.statusReports?.length > 0 && data3.statusReports?.length > 0) {
        expect(data2.statusReports[0].id).not.toBe(data3.statusReports[0].id);
      }
    }
  });

  test("filters by status", async () => {
    const res = await connectRequest(
      "ListStatusReports",
      { statuses: ["STATUS_REPORT_STATUS_INVESTIGATING"] },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    // All returned reports should have investigating status
    for (const report of data.statusReports || []) {
      expect(report.status).toBe("STATUS_REPORT_STATUS_INVESTIGATING");
    }
  });

  test("only returns reports for authenticated workspace", async () => {
    // Create status report in workspace 2
    const otherReport = await db
      .insert(statusReport)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace-list`,
        status: "investigating",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "ListStatusReports",
        { limit: 100 },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      const reportIds = (data.statusReports || []).map(
        (r: { id: string }) => r.id,
      );

      expect(reportIds).not.toContain(String(otherReport.id));
    } finally {
      await db.delete(statusReport).where(eq(statusReport.id, otherReport.id));
    }
  });
});

describe("StatusReportService.UpdateStatusReport", () => {
  test("updates status report title", async () => {
    const res = await connectRequest(
      "UpdateStatusReport",
      {
        id: String(testStatusReportToUpdateId),
        title: `${TEST_PREFIX}-updated-title`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.title).toBe(`${TEST_PREFIX}-updated-title`);

    // Restore original title
    await db
      .update(statusReport)
      .set({ title: `${TEST_PREFIX}-to-update` })
      .where(eq(statusReport.id, testStatusReportToUpdateId));
  });

  test("updates page component associations", async () => {
    // Use existing seeded page component 1
    const res = await connectRequest(
      "UpdateStatusReport",
      {
        id: String(testStatusReportToUpdateId),
        pageComponentIds: ["1"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusReport.pageComponentIds).toContain("1");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("UpdateStatusReport", {
      id: String(testStatusReportToUpdateId),
      title: "Unauthorized update",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent status report", async () => {
    const res = await connectRequest(
      "UpdateStatusReport",
      { id: "99999", title: "Non-existent update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

describe("StatusReportService.DeleteStatusReport", () => {
  test("successfully deletes existing status report", async () => {
    const res = await connectRequest(
      "DeleteStatusReport",
      { id: String(testStatusReportToDeleteId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify it's deleted
    const deleted = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, testStatusReportToDeleteId))
      .get();
    expect(deleted).toBeUndefined();
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("DeleteStatusReport", { id: "1" });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent status report", async () => {
    const res = await connectRequest(
      "DeleteStatusReport",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

describe("StatusReportService.AddStatusReportUpdate", () => {
  test("adds update to existing status report", async () => {
    const res = await connectRequest(
      "AddStatusReportUpdate",
      {
        statusReportId: String(testStatusReportId),
        status: "STATUS_REPORT_STATUS_MONITORING",
        message: "We are monitoring the fix.",
        date: new Date().toISOString(),
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.status).toBe("STATUS_REPORT_STATUS_MONITORING");
    // Should now have 3 updates (2 initial + 1 new)
    expect(data.statusReport.updates.length).toBeGreaterThanOrEqual(3);

    const newUpdate = data.statusReport.updates.find(
      (u: { message: string }) => u.message === "We are monitoring the fix.",
    );
    expect(newUpdate).toBeDefined();
    expect(newUpdate.status).toBe("STATUS_REPORT_STATUS_MONITORING");
  });

  test("uses current time when date is not provided", async () => {
    // Allow 2 second tolerance for timing differences
    const beforeTime = new Date(Date.now() - 2000);

    const res = await connectRequest(
      "AddStatusReportUpdate",
      {
        statusReportId: String(testStatusReportId),
        status: "STATUS_REPORT_STATUS_RESOLVED",
        message: "Issue has been resolved.",
      },
      { "x-openstatus-key": "1" },
    );

    const afterTime = new Date(Date.now() + 2000);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusReport.status).toBe("STATUS_REPORT_STATUS_RESOLVED");

    const newUpdate = data.statusReport.updates.find(
      (u: { message: string }) => u.message === "Issue has been resolved.",
    );
    expect(newUpdate).toBeDefined();

    const updateDate = new Date(newUpdate.date);
    expect(updateDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(updateDate.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("AddStatusReportUpdate", {
      statusReportId: String(testStatusReportId),
      status: "STATUS_REPORT_STATUS_RESOLVED",
      message: "Unauthorized update",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent status report", async () => {
    const res = await connectRequest(
      "AddStatusReportUpdate",
      {
        statusReportId: "99999",
        status: "STATUS_REPORT_STATUS_RESOLVED",
        message: "Non-existent report",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});
