import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, statusReport } from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

let otherWorkspacePageId: number;

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
});

afterAll(async () => {
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
