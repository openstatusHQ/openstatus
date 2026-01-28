import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  page,
  pageComponent,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails";
import { StatusReportStatus } from "@openstatus/proto/status_report/v1";

import { app } from "@/index";
import { protoStatusToDb } from "../converters";

// Mock the sendStatusReportUpdate method
const sendStatusReportUpdateMock = spyOn(
  EmailClient.prototype,
  "sendStatusReportUpdate",
).mockResolvedValue(undefined);

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
let testStatusReportForNotifyId: number;
let testSubscriberId: number;
// For mixed-page validation tests
let testPage2Id: number;
let testPage2ComponentId: number;

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
      type: "external",
      name: `${TEST_PREFIX}-component-2`,
      description: "Test component on page 2",
      order: 100,
    })
    .returning()
    .get();
  testPage2ComponentId = component2.id;

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

  // Create status report for notify tests
  const notifyReport = await db
    .insert(statusReport)
    .values({
      workspaceId: 1,
      pageId: 1,
      title: `${TEST_PREFIX}-for-notify`,
      status: "investigating",
    })
    .returning()
    .get();
  testStatusReportForNotifyId = notifyReport.id;

  await db.insert(statusReportsToPageComponents).values({
    statusReportId: notifyReport.id,
    pageComponentId: testPageComponentId,
  });

  // Create a verified subscriber for notification tests
  const subscriber = await db
    .insert(pageSubscriber)
    .values({
      pageId: 1,
      email: `${TEST_PREFIX}@example.com`,
      token: `${TEST_PREFIX}-token`,
      acceptedAt: new Date(),
    })
    .returning()
    .get();
  testSubscriberId = subscriber.id;
});

afterAll(async () => {
  // Clean up subscriber first (only if it was created)
  if (testSubscriberId) {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.id, testSubscriberId));
  }

  // Clean up status report updates first (due to foreign key)
  await db
    .delete(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, testStatusReportId));
  await db
    .delete(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, testStatusReportToUpdateId));
  await db
    .delete(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, testStatusReportForNotifyId));

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
  await db
    .delete(statusReportsToPageComponents)
    .where(
      eq(
        statusReportsToPageComponents.statusReportId,
        testStatusReportForNotifyId,
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
  await db
    .delete(statusReport)
    .where(eq(statusReport.title, `${TEST_PREFIX}-for-notify`));

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

describe("StatusReportService.CreateStatusReport", () => {
  test("creates a new status report with initial update", async () => {
    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX}-created`,
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "We are looking into this issue.",
        date: new Date().toISOString(),
        pageId: "1",
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
      pageId: "1",
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
        pageId: "1",
        pageComponentIds: ["99999"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when page components are from different pages", async () => {
    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX}-mixed-pages`,
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "Test message",
        date: new Date().toISOString(),
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

  test("derives pageId from components when creating status report", async () => {
    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX}-derived-pageid`,
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "Test deriving pageId from components.",
        date: new Date().toISOString(),
        pageId: "1", // This is ignored, pageId is derived from components
        pageComponentIds: [String(testPage2ComponentId)],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.pageComponentIds).toContain(
      String(testPage2ComponentId),
    );

    // Verify the pageId was derived from the component (page 2)
    const createdReport = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, Number(data.statusReport.id)))
      .get();
    expect(createdReport?.pageId).toBe(testPage2Id);

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

  test("sets pageId to null when no components provided", async () => {
    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX}-null-pageid`,
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "Test null pageId when no components.",
        date: new Date().toISOString(),
        pageId: "1", // This should be ignored
        pageComponentIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");

    // Verify the pageId is null
    const createdReport = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, Number(data.statusReport.id)))
      .get();
    expect(createdReport?.pageId).toBeNull();

    // Clean up
    await db
      .delete(statusReportUpdate)
      .where(
        eq(statusReportUpdate.statusReportId, Number(data.statusReport.id)),
      );
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, Number(data.statusReport.id)));
  });

  test("creates status report with empty pageComponentIds", async () => {
    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX}-no-components`,
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "Report without components.",
        date: new Date().toISOString(),
        pageId: "1",
        pageComponentIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.title).toBe(`${TEST_PREFIX}-no-components`);
    // Empty array may be serialized as undefined or empty array in proto
    const pageComponentIds = data.statusReport.pageComponentIds ?? [];
    expect(pageComponentIds).toHaveLength(0);

    // Clean up
    await db
      .delete(statusReportUpdate)
      .where(
        eq(statusReportUpdate.statusReportId, Number(data.statusReport.id)),
      );
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, Number(data.statusReport.id)));
  });

  test("creates status report with notify=true", async () => {
    sendStatusReportUpdateMock.mockClear();

    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX}-with-notify`,
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "Notifying subscribers about this issue.",
        date: new Date().toISOString(),
        pageId: "1",
        pageComponentIds: [String(testPageComponentId)],
        notify: true,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.title).toBe(`${TEST_PREFIX}-with-notify`);
    expect(data.statusReport.updates).toHaveLength(1);

    // Verify notification was sent
    expect(sendStatusReportUpdateMock).toHaveBeenCalledTimes(1);
    const mockCall = sendStatusReportUpdateMock.mock.calls[0][0];
    expect(mockCall.reportTitle).toBe(`${TEST_PREFIX}-with-notify`);
    expect(mockCall.status).toBe("investigating");
    expect(mockCall.message).toBe("Notifying subscribers about this issue.");

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

  test("creates status report with notify=false (default)", async () => {
    sendStatusReportUpdateMock.mockClear();

    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX}-no-notify`,
        status: "STATUS_REPORT_STATUS_IDENTIFIED",
        message: "No notification for this one.",
        date: new Date().toISOString(),
        pageId: "1",
        pageComponentIds: [],
        notify: false,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.title).toBe(`${TEST_PREFIX}-no-notify`);

    // Verify notification was NOT sent
    expect(sendStatusReportUpdateMock).not.toHaveBeenCalled();

    // Clean up
    await db
      .delete(statusReportUpdate)
      .where(
        eq(statusReportUpdate.statusReportId, Number(data.statusReport.id)),
      );
    await db
      .delete(statusReport)
      .where(eq(statusReport.id, Number(data.statusReport.id)));
  });

  test("returns error for invalid date format", async () => {
    const res = await connectRequest(
      "CreateStatusReport",
      {
        title: `${TEST_PREFIX}-invalid-date`,
        status: "STATUS_REPORT_STATUS_INVESTIGATING",
        message: "Test with invalid date.",
        date: "not-a-valid-date",
        pageId: "1",
        pageComponentIds: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("date: value does not match regex pattern");
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

  test("returns error when ID is empty string", async () => {
    const res = await connectRequest(
      "GetStatusReport",
      { id: "" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns error when ID is whitespace only", async () => {
    const res = await connectRequest(
      "GetStatusReport",
      { id: "   " },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
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

  test("filters by multiple statuses", async () => {
    // Create reports with different statuses
    const monitoringReport = await db
      .insert(statusReport)
      .values({
        workspaceId: 1,
        pageId: 1,
        title: `${TEST_PREFIX}-monitoring-filter`,
        status: "monitoring",
      })
      .returning()
      .get();

    const resolvedReport = await db
      .insert(statusReport)
      .values({
        workspaceId: 1,
        pageId: 1,
        title: `${TEST_PREFIX}-resolved-filter`,
        status: "resolved",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "ListStatusReports",
        {
          statuses: [
            "STATUS_REPORT_STATUS_MONITORING",
            "STATUS_REPORT_STATUS_RESOLVED",
          ],
        },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      // All returned reports should have monitoring or resolved status
      for (const report of data.statusReports || []) {
        expect([
          "STATUS_REPORT_STATUS_MONITORING",
          "STATUS_REPORT_STATUS_RESOLVED",
        ]).toContain(report.status);
      }
    } finally {
      await db
        .delete(statusReport)
        .where(eq(statusReport.id, monitoringReport.id));
      await db
        .delete(statusReport)
        .where(eq(statusReport.id, resolvedReport.id));
    }
  });

  test("returns all statuses when statuses filter is empty", async () => {
    const res = await connectRequest(
      "ListStatusReports",
      { statuses: [] },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReports");
    expect(data).toHaveProperty("totalSize");
  });

  test("ignores UNSPECIFIED status in filter", async () => {
    const res = await connectRequest(
      "ListStatusReports",
      {
        statuses: [
          "STATUS_REPORT_STATUS_UNSPECIFIED",
          "STATUS_REPORT_STATUS_INVESTIGATING",
        ],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    // Should only return investigating status (UNSPECIFIED is ignored)
    for (const report of data.statusReports || []) {
      expect(report.status).toBe("STATUS_REPORT_STATUS_INVESTIGATING");
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

  test("returns error when ID is empty string", async () => {
    const res = await connectRequest(
      "UpdateStatusReport",
      { id: "", title: "Empty ID update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns error when ID is whitespace only", async () => {
    const res = await connectRequest(
      "UpdateStatusReport",
      { id: "   ", title: "Whitespace ID update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for status report in different workspace", async () => {
    // Create status report in workspace 2
    const otherReport = await db
      .insert(statusReport)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace-update`,
        status: "investigating",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "UpdateStatusReport",
        { id: String(otherReport.id), title: "Should not update" },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);
    } finally {
      await db.delete(statusReport).where(eq(statusReport.id, otherReport.id));
    }
  });

  test("returns error for invalid page component ID on update", async () => {
    const res = await connectRequest(
      "UpdateStatusReport",
      {
        id: String(testStatusReportToUpdateId),
        pageComponentIds: ["99999"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when updating with components from different pages", async () => {
    const res = await connectRequest(
      "UpdateStatusReport",
      {
        id: String(testStatusReportToUpdateId),
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

  test("updates pageId when changing components to different page", async () => {
    // First verify the current pageId
    const beforeReport = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, testStatusReportToUpdateId))
      .get();
    expect(beforeReport?.pageId).toBe(1);

    // Update to use component from page 2
    const res = await connectRequest(
      "UpdateStatusReport",
      {
        id: String(testStatusReportToUpdateId),
        pageComponentIds: [String(testPage2ComponentId)],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    // Verify the pageId was updated to page 2
    const afterReport = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.id, testStatusReportToUpdateId))
      .get();
    expect(afterReport?.pageId).toBe(testPage2Id);

    // Restore original component association
    await connectRequest(
      "UpdateStatusReport",
      {
        id: String(testStatusReportToUpdateId),
        pageComponentIds: [String(testPageComponentId)],
      },
      { "x-openstatus-key": "1" },
    );
  });

  test("clears pageId when removing all components", async () => {
    // Create a temporary status report for this test
    const tempReport = await db
      .insert(statusReport)
      .values({
        workspaceId: 1,
        pageId: 1,
        title: `${TEST_PREFIX}-clear-pageid`,
        status: "investigating",
      })
      .returning()
      .get();

    await db.insert(statusReportsToPageComponents).values({
      statusReportId: tempReport.id,
      pageComponentId: testPageComponentId,
    });

    try {
      // Clear all components
      const res = await connectRequest(
        "UpdateStatusReport",
        {
          id: String(tempReport.id),
          pageComponentIds: [],
        },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      // Verify the pageId is now null
      const afterReport = await db
        .select()
        .from(statusReport)
        .where(eq(statusReport.id, tempReport.id))
        .get();
      expect(afterReport?.pageId).toBeNull();
    } finally {
      // Clean up
      await db
        .delete(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, tempReport.id));
      await db.delete(statusReport).where(eq(statusReport.id, tempReport.id));
    }
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

  test("returns error when ID is empty string", async () => {
    const res = await connectRequest(
      "DeleteStatusReport",
      { id: "" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns error when ID is whitespace only", async () => {
    const res = await connectRequest(
      "DeleteStatusReport",
      { id: "   " },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for status report in different workspace", async () => {
    // Create status report in workspace 2
    const otherReport = await db
      .insert(statusReport)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace-delete`,
        status: "investigating",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "DeleteStatusReport",
        { id: String(otherReport.id) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);

      // Verify it wasn't deleted
      const stillExists = await db
        .select()
        .from(statusReport)
        .where(eq(statusReport.id, otherReport.id))
        .get();
      expect(stillExists).toBeDefined();
    } finally {
      await db.delete(statusReport).where(eq(statusReport.id, otherReport.id));
    }
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

  test("returns error when statusReportId is empty string", async () => {
    const res = await connectRequest(
      "AddStatusReportUpdate",
      {
        statusReportId: "",
        status: "STATUS_REPORT_STATUS_RESOLVED",
        message: "Empty ID update",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns error when statusReportId is whitespace only", async () => {
    const res = await connectRequest(
      "AddStatusReportUpdate",
      {
        statusReportId: "   ",
        status: "STATUS_REPORT_STATUS_RESOLVED",
        message: "Whitespace ID update",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for status report in different workspace", async () => {
    // Create status report in workspace 2
    const otherReport = await db
      .insert(statusReport)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace-add-update`,
        status: "investigating",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "AddStatusReportUpdate",
        {
          statusReportId: String(otherReport.id),
          status: "STATUS_REPORT_STATUS_RESOLVED",
          message: "Should not add to other workspace",
        },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);
    } finally {
      await db.delete(statusReport).where(eq(statusReport.id, otherReport.id));
    }
  });

  test("adds update with notify=true", async () => {
    sendStatusReportUpdateMock.mockClear();

    const res = await connectRequest(
      "AddStatusReportUpdate",
      {
        statusReportId: String(testStatusReportForNotifyId),
        status: "STATUS_REPORT_STATUS_IDENTIFIED",
        message: "We identified the issue and are notifying subscribers.",
        date: new Date().toISOString(),
        notify: true,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.status).toBe("STATUS_REPORT_STATUS_IDENTIFIED");

    const newUpdate = data.statusReport.updates.find(
      (u: { message: string }) =>
        u.message === "We identified the issue and are notifying subscribers.",
    );
    expect(newUpdate).toBeDefined();

    // Verify notification was sent
    expect(sendStatusReportUpdateMock).toHaveBeenCalledTimes(1);
    const mockCall = sendStatusReportUpdateMock.mock.calls[0][0];
    expect(mockCall.reportTitle).toBe(`${TEST_PREFIX}-for-notify`);
    expect(mockCall.status).toBe("identified");
    expect(mockCall.message).toBe(
      "We identified the issue and are notifying subscribers.",
    );
  });

  test("adds update with notify=false", async () => {
    sendStatusReportUpdateMock.mockClear();

    const res = await connectRequest(
      "AddStatusReportUpdate",
      {
        statusReportId: String(testStatusReportForNotifyId),
        status: "STATUS_REPORT_STATUS_MONITORING",
        message: "Monitoring without notification.",
        date: new Date().toISOString(),
        notify: false,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusReport");
    expect(data.statusReport.status).toBe("STATUS_REPORT_STATUS_MONITORING");

    // Verify notification was NOT sent
    expect(sendStatusReportUpdateMock).not.toHaveBeenCalled();
  });

  test("updates status report status when adding update", async () => {
    // First verify the current status
    const getRes = await connectRequest(
      "GetStatusReport",
      { id: String(testStatusReportForNotifyId) },
      { "x-openstatus-key": "1" },
    );
    const getData = await getRes.json();
    const initialStatus = getData.statusReport.status;

    // Add update with different status
    const newStatus =
      initialStatus === "STATUS_REPORT_STATUS_RESOLVED"
        ? "STATUS_REPORT_STATUS_INVESTIGATING"
        : "STATUS_REPORT_STATUS_RESOLVED";

    const res = await connectRequest(
      "AddStatusReportUpdate",
      {
        statusReportId: String(testStatusReportForNotifyId),
        status: newStatus,
        message: "Status change test.",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusReport.status).toBe(newStatus);
  });

  test("returns error for invalid date format", async () => {
    const res = await connectRequest(
      "AddStatusReportUpdate",
      {
        statusReportId: String(testStatusReportId),
        status: "STATUS_REPORT_STATUS_MONITORING",
        message: "Test with invalid date.",
        date: "not-a-valid-date",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("date: value does not match regex pattern");
  });
});

describe("protoStatusToDb converter", () => {
  test("converts valid statuses correctly", () => {
    expect(protoStatusToDb(StatusReportStatus.INVESTIGATING)).toBe(
      "investigating",
    );
    expect(protoStatusToDb(StatusReportStatus.IDENTIFIED)).toBe("identified");
    expect(protoStatusToDb(StatusReportStatus.MONITORING)).toBe("monitoring");
    expect(protoStatusToDb(StatusReportStatus.RESOLVED)).toBe("resolved");
  });

  test("throws error for UNSPECIFIED status", () => {
    expect(() => protoStatusToDb(StatusReportStatus.UNSPECIFIED)).toThrow(
      "Invalid status value",
    );
  });

  test("throws error for unknown status values", () => {
    // Simulate a new status value being added to the proto
    const unknownStatus = 999 as StatusReportStatus;
    expect(() => protoStatusToDb(unknownStatus)).toThrow(
      "Invalid status value",
    );
  });
});
