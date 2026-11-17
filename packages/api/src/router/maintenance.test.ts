import { db, eq } from "@openstatus/db";
import {
  maintenance,
  maintenanceUpdate,
  maintenancesToPageComponents,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import { clearAuditLogFor } from "@openstatus/services/test/helpers";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, expect, test } from "vitest";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

let otherWorkspaceMaintenanceId: number;
let otherWorkspacePageId: number;
let otherWorkspaceComponentId: number;

// Track maintenance ids the tRPC service writes / mutates. Without this
// the `maintenance.create` / `maintenance.update` audit rows outlive
// the row itself and — because INTEGER PRIMARY KEY recycles — a later
// test inserting into `maintenance` can land on the orphan's id and
// inherit its actor attribution. See packages/services/AGENTS.md.
const createdMaintenanceIds: number[] = [];
const updatedMaintenanceIds: number[] = [];
const createdMaintenanceUpdateIds: number[] = [];
// derived and user windows the tests leave audit rows for
const windowIds: number[] = [];

beforeAll(async () => {
  const p = await db
    .insert(page)
    .values({
      workspaceId: 3,
      title: "Maintenance IDOR Test Page",
      description: "Page for maintenance IDOR testing",
      slug: "maintenance-idor-test-page",
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

  // Maintenance for workspace 2, referencing page 1 (page ownership is not
  // enforced at DB level, only at API level, so this insert works for testing)
  const m = await db
    .insert(maintenance)
    .values({
      workspaceId: 3,
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
      pageComponentId: otherWorkspaceComponentId,
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
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.id, otherWorkspaceComponentId));
  await db.delete(page).where(eq(page.id, otherWorkspacePageId));

  if (createdMaintenanceIds.length > 0) {
    await clearAuditLogFor({
      entityType: "maintenance",
      entityIds: createdMaintenanceIds,
    });
  }
  if (updatedMaintenanceIds.length > 0) {
    await clearAuditLogFor({
      entityType: "maintenance",
      entityIds: updatedMaintenanceIds,
    });
  }
  if (windowIds.length > 0) {
    await clearAuditLogFor({
      entityType: "monitor_maintenance_window",
      entityIds: windowIds,
    });
  }
  if (createdMaintenanceUpdateIds.length > 0) {
    await clearAuditLogFor({
      entityType: "maintenance_update",
      entityIds: createdMaintenanceUpdateIds,
    });
  }
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
    startDate: new Date(),
    endDate: new Date(Date.now() + 7_200_000),
    pageComponents: [1],
  });
  updatedMaintenanceIds.push(1);

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
  createdMaintenanceIds.push(result.id);
  // component 1 is monitor-backed: the maintenance gets its derived window
  expect(result.monitorMaintenanceWindowId).not.toBeNull();
  if (result.monitorMaintenanceWindowId) {
    windowIds.push(result.monitorMaintenanceWindowId);
  }

  // Cleanup
  await db
    .delete(maintenancesToPageComponents)
    .where(eq(maintenancesToPageComponents.maintenanceId, result.id));
  await db.delete(maintenance).where(eq(maintenance.id, result.id));
});

test("maintenance update procedures provide full CRUD", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);
  const created = await caller.maintenance.new({
    title: "Maintenance update CRUD",
    message: "Initial update",
    pageId: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 3_600_000),
    pageComponents: [1],
  });
  createdMaintenanceIds.push(created.id);
  if (created.monitorMaintenanceWindowId) {
    windowIds.push(created.monitorMaintenanceWindowId);
  }

  const added = await caller.maintenance.createUpdate({
    maintenanceId: created.id,
    message: "Second update",
    date: new Date(),
    notifySubscribers: true,
  });
  createdMaintenanceUpdateIds.push(added.id);
  expect(added.notifySubscribers).toBe(true);

  const edited = await caller.maintenance.updateUpdate({
    id: added.id,
    message: "Edited update",
  });
  expect(edited.message).toBe("Edited update");

  const found = await caller.maintenance.get({ id: created.id });
  expect(found.updates.map((u) => u.message)).toEqual([
    "Edited update",
    "Initial update",
  ]);
  // `message` is the newest update
  expect(found.message).toBe("Edited update");

  await caller.maintenance.deleteUpdate({ id: added.id });
  const deleted = await db.query.maintenanceUpdate.findFirst({
    where: eq(maintenanceUpdate.id, added.id),
  });
  expect(deleted).toBeUndefined();

  try {
    await caller.maintenance.deleteUpdate({ id: added.id });
    throw new Error("Should have thrown");
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    expect((error as TRPCError).code).toBe("NOT_FOUND");
  }

  await caller.maintenance.delete({ id: created.id });
});

test("maintenance.linkWindow swaps the derived window for a user window, unlinkWindow derives it again", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  const caller = edgeRouter.createCaller(ctx);
  const from = new Date(Math.floor(Date.now() / 1000) * 1000 + 3_600_000);
  const to = new Date(from.getTime() + 3_600_000);
  const created = await caller.maintenance.new({
    title: "Link window",
    message: "m",
    pageId: 1,
    startDate: from,
    endDate: to,
    pageComponents: [1],
  });
  createdMaintenanceIds.push(created.id);
  const derivedId = created.monitorMaintenanceWindowId;
  if (!derivedId) throw new Error("expected a derived window");
  windowIds.push(derivedId);

  const window = await caller.maintenanceWindow.create({
    title: "User window",
    mode: "continue",
    from: new Date(from.getTime() + 600_000),
    to: new Date(to.getTime() - 600_000),
    monitorIds: [1],
  });
  windowIds.push(window.id);

  try {
    await expect(
      caller.maintenance.linkWindow({
        id: otherWorkspaceMaintenanceId,
        monitorMaintenanceWindowId: window.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.maintenanceWindow.delete({ id: derivedId }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const linked = await caller.maintenance.linkWindow({
      id: created.id,
      monitorMaintenanceWindowId: window.id,
    });
    expect(linked?.monitorMaintenanceWindowId).toBe(window.id);
    // the public times stay the maintenance's own
    expect(linked?.from).toEqual(from);
    const windows = await caller.maintenanceWindow.list();
    expect(windows.find((w) => w.id === derivedId)).toBeUndefined();
    expect(
      windows.find((w) => w.id === window.id)?.announcements.map((a) => a.id),
    ).toEqual([created.id]);

    const unlinked = await caller.maintenance.unlinkWindow({ id: created.id });
    const rederivedId = unlinked?.monitorMaintenanceWindowId;
    expect(rederivedId).not.toBeNull();
    expect(rederivedId).not.toBe(window.id);
    if (rederivedId) windowIds.push(rederivedId);
    const found = await caller.maintenance.get({ id: created.id });
    expect(found.window).toMatchObject({ derived: true, mode: "pause", from });
  } finally {
    await caller.maintenance.delete({ id: created.id });
    await caller.maintenanceWindow.delete({ id: window.id });
  }
});
