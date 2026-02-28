import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  page,
  pageComponent,
  statusReport,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

let otherWorkspacePageId: number;
let otherWorkspaceReportId: number;
let otherWorkspaceComponentId: number;

beforeAll(async () => {
  const p = await db
    .insert(page)
    .values({
      workspaceId: 2,
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
      workspaceId: 2,
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
      workspaceId: 2,
      title: "Other workspace report",
      status: "investigating",
      pageId: otherWorkspacePageId,
    })
    .returning()
    .get();
  otherWorkspaceReportId = report.id;

  await db
    .insert(statusReportsToPageComponents)
    .values({ statusReportId: otherWorkspaceReportId, pageComponentId: 1 })
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

  // Clean up
  await db.delete(statusReport).where(eq(statusReport.id, result.id));
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
    expect((e as TRPCError).code).toBe("FORBIDDEN");
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
    expect((e as TRPCError).code).toBe("FORBIDDEN");
  }

  // Verify the report was NOT modified
  const report = await db.query.statusReport.findFirst({
    where: eq(statusReport.id, 1),
  });
  expect(report?.title).toBe("Updated Title"); // still the value from the previous test
});
