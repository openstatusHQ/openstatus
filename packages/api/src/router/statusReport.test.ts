import { afterAll, beforeAll, expect, test } from "bun:test";

import { db, eq, inArray } from "@openstatus/db";
import {
  page,
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import { clearAuditLogFor } from "@openstatus/services/test/helpers";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

let otherWorkspacePageId: number;
let otherWorkspaceReportId: number;
let otherWorkspaceComponentId: number;

// Track ids the service writes so afterAll can scrub the resulting
// audit rows. `caller.statusReport.create` returns the initial-update
// row (not the report), so the original cleanup-via-`result.id` never
// reached the parent — leaving an orphan report and an orphan audit row.
// SQLite recycles INTEGER PRIMARY KEY ids on delete, so a later test
// inserting a status_report could land on the orphan's id and inherit
// its `actor_type=user` attribution. See docs/adr/test-audit-cleanup.md.
const createdReportIds: number[] = [];
const updatedReportIds: number[] = [];

beforeAll(async () => {
  const p = await db
    .insert(page)
    .values({
      workspaceId: 3,
      title: "IDOR Test Page",
      description: "Page for IDOR testing",
      slug: "idor-test-page",
      customDomain: "",
    })
    .returning()
    .get();
  otherWorkspacePageId = p.id;

  const component = await db
    .insert(pageComponent)
    .values({
      workspaceId: 3,
      pageId: otherWorkspacePageId,
      name: "Other workspace component",
      type: "static",
    })
    .returning()
    .get();
  otherWorkspaceComponentId = component.id;

  const report = await db
    .insert(statusReport)
    .values({
      workspaceId: 3,
      title: "Other workspace report",
      status: "investigating",
      pageId: otherWorkspacePageId,
    })
    .returning()
    .get();
  otherWorkspaceReportId = report.id;

  await db
    .insert(statusReportsToPageComponents)
    .values({
      statusReportId: otherWorkspaceReportId,
      pageComponentId: otherWorkspaceComponentId,
    })
    .run();
});

afterAll(async () => {
  await db
    .delete(statusReportsToPageComponents)
    .where(
      eq(statusReportsToPageComponents.statusReportId, otherWorkspaceReportId),
    );
  await db
    .delete(statusReport)
    .where(eq(statusReport.id, otherWorkspaceReportId));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.id, otherWorkspaceComponentId));
  await db.delete(page).where(eq(page.id, otherWorkspacePageId));

  // Drop entities + audit rows the tRPC service emitted during the
  // tests. Children (status_report_update + join rows) first; then the
  // parent; then `audit_log` so no orphan rows survive the suite.
  if (createdReportIds.length > 0) {
    const updateRows = await db
      .select({ id: statusReportUpdate.id })
      .from(statusReportUpdate)
      .where(inArray(statusReportUpdate.statusReportId, createdReportIds))
      .all();
    const updateIds = updateRows.map((r) => r.id);
    await db
      .delete(statusReportsToPageComponents)
      .where(
        inArray(statusReportsToPageComponents.statusReportId, createdReportIds),
      );
    await db
      .delete(statusReportUpdate)
      .where(inArray(statusReportUpdate.statusReportId, createdReportIds));
    await db
      .delete(statusReport)
      .where(inArray(statusReport.id, createdReportIds));
    await clearAuditLogFor({
      entityType: "status_report",
      entityIds: createdReportIds,
    });
    await clearAuditLogFor({
      entityType: "status_report_update",
      entityIds: updateIds,
    });
  }
  // `updateStatus` only mutates an existing report; the row stays, but
  // its `status_report.update` audit entry is the test's only side
  // effect and must not outlive the suite.
  if (updatedReportIds.length > 0) {
    await clearAuditLogFor({
      entityType: "status_report",
      entityIds: updatedReportIds,
    });
  }
});

test("statusReport.create rejects pageId from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.statusReport.create({
      title: "Test Report",
      status: "investigating",
      pageId: otherWorkspacePageId,
      pageComponents: [],
      date: new Date(),
      message: "Testing cross-workspace access",
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("statusReport.create succeeds for own workspace page", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  const result = await caller.statusReport.create({
    title: "Valid Test Report",
    status: "investigating",
    pageId: 1,
    pageComponents: [],
    date: new Date(),
    message: "Testing own workspace access",
  });

  expect(result).toBeDefined();

  // `result.id` is the initial status_report_update id, not the parent
  // report — recover the report id via the FK so afterAll can scrub both
  // it and its audit row.
  if (result) {
    const updateRow = await db
      .select({ statusReportId: statusReportUpdate.statusReportId })
      .from(statusReportUpdate)
      .where(eq(statusReportUpdate.id, result.id))
      .get();
    if (updateRow?.statusReportId != null) {
      createdReportIds.push(updateRow.statusReportId);
    }
  }
});

test("statusReport.updateStatus rejects report from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.statusReport.updateStatus({
      id: otherWorkspaceReportId,
      pageComponents: [],
      title: "Unauthorized Modification",
      status: "investigating",
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }

  // Verify page component associations were NOT deleted
  const associations = await db.query.statusReportsToPageComponents.findMany({
    where: eq(
      statusReportsToPageComponents.statusReportId,
      otherWorkspaceReportId,
    ),
  });
  expect(associations.length).toBe(1);
});

test("statusReport.updateStatus succeeds for own workspace report", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  // Seed status report 1 belongs to workspace 1
  await caller.statusReport.updateStatus({
    id: 1,
    pageComponents: [1],
    title: "Updated Title",
    status: "resolved",
  });
  updatedReportIds.push(1);

  const updated = await db.query.statusReport.findFirst({
    where: eq(statusReport.id, 1),
  });
  expect(updated?.title).toBe("Updated Title");
});

test("statusReport.create rejects pageComponents from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.statusReport.create({
      title: "Cross-workspace injection",
      status: "investigating",
      pageId: 1, // valid page for workspace 1
      pageComponents: [otherWorkspaceComponentId], // component from workspace 2
      date: new Date(),
      message: "Should be rejected",
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    // Cross-workspace component IDs resolve to `NOT_FOUND` (not
    // `FORBIDDEN`) — the service doesn't leak existence of resources
    // in other workspaces, so callers see them as missing rather than
    // off-limits. This is the new services-migration behavior.
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("statusReport.updateStatus rejects pageComponents from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.statusReport.updateStatus({
      id: 1, // valid report for workspace 1
      pageComponents: [otherWorkspaceComponentId], // component from workspace 2
      title: "Cross-workspace injection",
      status: "investigating",
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    // See cross-workspace note in `statusReport.create` test above.
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }

  // Verify the report was NOT modified
  const report = await db.query.statusReport.findFirst({
    where: eq(statusReport.id, 1),
  });
  expect(report?.title).toBe("Updated Title"); // still the value from the previous test
});
