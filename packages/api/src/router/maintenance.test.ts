import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
} from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

let otherWorkspaceMaintenanceId: number;
let otherWorkspacePageId: number;

beforeAll(async () => {
  const p = await db
    .insert(page)
    .values({
      workspaceId: 2,
      title: "Maintenance IDOR Test Page",
      description: "Page for maintenance IDOR testing",
      slug: "maintenance-idor-test-page",
      customDomain: "",
    })
    .returning()
    .get();
  otherWorkspacePageId = p.id;

  // Maintenance for workspace 2, referencing page 1 (page ownership is not
  // enforced at DB level, only at API level, so this insert works for testing)
  const m = await db
    .insert(maintenance)
    .values({
      workspaceId: 2,
      title: "Other workspace maintenance",
      message: "Scheduled maintenance",
      pageId: 1,
      from: new Date(),
      to: new Date(Date.now() + 3_600_000),
    })
    .returning()
    .get();
  otherWorkspaceMaintenanceId = m.id;

  await db
    .insert(maintenancesToPageComponents)
    .values({
      maintenanceId: otherWorkspaceMaintenanceId,
      pageComponentId: 1,
    })
    .run();
});

afterAll(async () => {
  await db
    .delete(maintenancesToPageComponents)
    .where(
      eq(
        maintenancesToPageComponents.maintenanceId,
        otherWorkspaceMaintenanceId,
      ),
    );
  await db
    .delete(maintenance)
    .where(eq(maintenance.id, otherWorkspaceMaintenanceId));
  await db.delete(page).where(eq(page.id, otherWorkspacePageId));
});

test("maintenance.update rejects maintenance from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.maintenance.update({
      id: otherWorkspaceMaintenanceId,
      title: "Unauthorized Modification",
      message: "Should not work",
      startDate: new Date(),
      endDate: new Date(Date.now() + 3_600_000),
      pageComponents: [],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }

  // Verify page component associations were NOT deleted
  const associations = await db.query.maintenancesToPageComponents.findMany({
    where: eq(
      maintenancesToPageComponents.maintenanceId,
      otherWorkspaceMaintenanceId,
    ),
  });
  expect(associations.length).toBe(1);
});

test("maintenance.update succeeds for own workspace maintenance", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  // Seed maintenance 1 belongs to workspace 1
  await caller.maintenance.update({
    id: 1,
    title: "Updated Maintenance Title",
    message: "Updated message",
    startDate: new Date(),
    endDate: new Date(Date.now() + 7_200_000),
    pageComponents: [1],
  });

  const updated = await db.query.maintenance.findFirst({
    where: eq(maintenance.id, 1),
  });
  expect(updated?.title).toBe("Updated Maintenance Title");
});

test("maintenance.new rejects pageId from another workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.maintenance.new({
      title: "Cross-workspace maintenance",
      message: "Should be rejected",
      pageId: otherWorkspacePageId, // page from workspace 2
      startDate: new Date(),
      endDate: new Date(Date.now() + 3_600_000),
      pageComponents: [],
    });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
});

test("maintenance.new succeeds for own workspace page", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);

  const result = await caller.maintenance.new({
    title: "Valid Maintenance",
    message: "Own workspace maintenance",
    pageId: 1, // page 1 belongs to workspace 1
    startDate: new Date(),
    endDate: new Date(Date.now() + 3_600_000),
    pageComponents: [1],
  });

  expect(result).toBeDefined();

  // Cleanup
  await db
    .delete(maintenancesToPageComponents)
    .where(eq(maintenancesToPageComponents.maintenanceId, result.id));
  await db.delete(maintenance).where(eq(maintenance.id, result.id));
});
