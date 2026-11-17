import { and, asc, eq, inArray, isNull, or } from "@openstatus/db";
import {
  maintenance,
  maintenanceUpdate,
  maintenancesToPageComponents,
  monitor,
  monitorMaintenanceWindow,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type DB, type ServiceContext, tryGetActorUserId } from "../context";
import { ConflictError, NotFoundError } from "../errors";
import {
  monitorIdsOf,
  replaceWindowMonitors,
} from "../maintenance-window/internal";

export type ValidatedPageComponents = {
  componentIds: number[];
  /** The page all components belong to, or `null` for an empty input. */
  pageId: number | null;
};

/**
 * Validate that every id in `pageComponentIds` exists, belongs to the
 * workspace, and — if more than one — that they all belong to the same page.
 * Duplicated deliberately from status-report's version; both talk to the same
 * `pageComponent` table but bind to different association tables downstream.
 */
export async function validatePageComponentIds(args: {
  tx: DB;
  workspaceId: number;
  pageComponentIds: ReadonlyArray<number>;
}): Promise<ValidatedPageComponents> {
  const { tx, workspaceId, pageComponentIds } = args;
  if (pageComponentIds.length === 0) {
    return { componentIds: [], pageId: null };
  }

  // Dedupe up-front — duplicate ids in the input would violate the composite
  // PK on `maintenances_to_page_components` during insert.
  const ids = Array.from(new Set(pageComponentIds));
  const valid = await tx
    .select({ id: pageComponent.id, pageId: pageComponent.pageId })
    .from(pageComponent)
    .where(
      and(
        inArray(pageComponent.id, ids),
        eq(pageComponent.workspaceId, workspaceId),
      ),
    )
    .all();

  const validById = new Map(valid.map((c) => [c.id, c.pageId]));
  for (const id of ids) {
    if (!validById.has(id)) {
      throw new NotFoundError("page_component", id);
    }
  }

  const pageIds = new Set(valid.map((c) => c.pageId));
  if (pageIds.size > 1) {
    throw new ConflictError(
      "All page components must belong to the same page.",
    );
  }

  return { componentIds: ids, pageId: valid[0]?.pageId ?? null };
}

export async function assertPageInWorkspace(args: {
  tx: DB;
  pageId: number;
  workspaceId: number;
}): Promise<void> {
  const { tx, pageId, workspaceId } = args;
  const row = await tx
    .select({ id: page.id })
    .from(page)
    .where(and(eq(page.id, pageId), eq(page.workspaceId, workspaceId)))
    .get();
  if (!row) throw new NotFoundError("page", pageId);
}

/** Replace the set of page-component associations for a maintenance. */
export async function updatePageComponentAssociations(args: {
  tx: DB;
  maintenanceId: number;
  componentIds: ReadonlyArray<number>;
}): Promise<void> {
  const { tx, maintenanceId, componentIds } = args;

  await tx
    .delete(maintenancesToPageComponents)
    .where(eq(maintenancesToPageComponents.maintenanceId, maintenanceId));

  if (componentIds.length > 0) {
    await tx.insert(maintenancesToPageComponents).values(
      componentIds.map((pageComponentId) => ({
        maintenanceId,
        pageComponentId,
      })),
    );
  }
}

/** Load a maintenance row by id, scoped to the workspace. Throws on miss. */
export async function getMaintenanceInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(maintenance)
    .where(
      and(eq(maintenance.id, id), eq(maintenance.workspaceId, workspaceId)),
    )
    .get();
  if (!row) throw new NotFoundError("maintenance", id);
  return row;
}

export async function getMaintenanceUpdateInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select({ update: maintenanceUpdate })
    .from(maintenanceUpdate)
    .innerJoin(maintenance, eq(maintenance.id, maintenanceUpdate.maintenanceId))
    .where(
      and(
        eq(maintenanceUpdate.id, id),
        eq(maintenance.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("maintenance_update", id);
  return row.update;
}

/** The distinct live monitors behind a maintenance's components, sorted. */
async function componentMonitorIds(
  tx: DB,
  workspaceId: number,
  maintenanceId: number,
): Promise<number[]> {
  const rows = await tx
    .selectDistinct({ id: monitor.id })
    .from(maintenancesToPageComponents)
    .innerJoin(
      pageComponent,
      eq(pageComponent.id, maintenancesToPageComponents.pageComponentId),
    )
    .innerJoin(monitor, eq(monitor.id, pageComponent.monitorId))
    .where(
      and(
        eq(maintenancesToPageComponents.maintenanceId, maintenanceId),
        eq(monitor.workspaceId, workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .orderBy(asc(monitor.id))
    .all();
  return rows.map((r) => r.id);
}

/**
 * Keeps the invariant: a maintenance has a derived window iff it announces no
 * user window and has a monitor behind a component. Every write that can
 * change either side calls this in its own transaction.
 */
export async function syncDerivedWindow(
  tx: DB,
  ctx: ServiceContext,
  maintenanceId: number,
): Promise<void> {
  const row = await tx
    .select()
    .from(maintenance)
    .where(
      and(
        eq(maintenance.id, maintenanceId),
        eq(maintenance.workspaceId, ctx.workspace.id),
      ),
    )
    .get();
  if (!row) return;
  const derived = await tx
    .select()
    .from(monitorMaintenanceWindow)
    .where(eq(monitorMaintenanceWindow.maintenanceId, row.id))
    .get();
  const announcesUserWindow =
    row.monitorMaintenanceWindowId !== null &&
    row.monitorMaintenanceWindowId !== derived?.id;
  const monitorIds = announcesUserWindow
    ? []
    : await componentMonitorIds(tx, ctx.workspace.id, row.id);
  const actorUserId = tryGetActorUserId(ctx.actor);

  if (monitorIds.length === 0) {
    if (!derived) return;
    const before = {
      ...derived,
      monitorIds: await monitorIdsOf(tx, derived.id),
    };
    await tx
      .update(maintenance)
      .set({ monitorMaintenanceWindowId: null })
      .where(
        and(
          eq(maintenance.id, row.id),
          eq(maintenance.monitorMaintenanceWindowId, derived.id),
        ),
      );
    await tx
      .delete(monitorMaintenanceWindow)
      .where(eq(monitorMaintenanceWindow.id, derived.id));
    await emitAudit(tx, ctx, {
      action: "monitor_maintenance_window.delete",
      entityType: "monitor_maintenance_window",
      entityId: derived.id,
      before,
    });
    return;
  }

  if (!derived) {
    const created = await tx
      .insert(monitorMaintenanceWindow)
      .values({
        workspaceId: ctx.workspace.id,
        title: row.title,
        mode: "pause",
        from: row.from,
        to: row.to,
        maintenanceId: row.id,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning()
      .get();
    await replaceWindowMonitors({ tx, windowId: created.id, monitorIds });
    await tx
      .update(maintenance)
      .set({ monitorMaintenanceWindowId: created.id })
      .where(eq(maintenance.id, row.id));
    await emitAudit(tx, ctx, {
      action: "monitor_maintenance_window.create",
      entityType: "monitor_maintenance_window",
      entityId: created.id,
      after: { ...created, monitorIds },
    });
    return;
  }

  const beforeIds = await monitorIdsOf(tx, derived.id);
  const sameMonitors =
    beforeIds.length === monitorIds.length &&
    beforeIds.every((id, i) => id === monitorIds[i]);
  if (
    sameMonitors &&
    derived.title === row.title &&
    derived.from.getTime() === row.from.getTime() &&
    derived.to.getTime() === row.to.getTime()
  ) {
    return;
  }
  if (!sameMonitors) {
    await replaceWindowMonitors({ tx, windowId: derived.id, monitorIds });
  }
  const updated = await tx
    .update(monitorMaintenanceWindow)
    .set({
      title: row.title,
      from: row.from,
      to: row.to,
      updatedBy: actorUserId,
      updatedAt: new Date(),
    })
    .where(eq(monitorMaintenanceWindow.id, derived.id))
    .returning()
    .get();
  await emitAudit(tx, ctx, {
    action: "monitor_maintenance_window.update",
    entityType: "monitor_maintenance_window",
    entityId: updated.id,
    before: { ...derived, monitorIds: beforeIds },
    after: { ...updated, monitorIds },
  });
}

export async function syncDerivedWindows(
  tx: DB,
  ctx: ServiceContext,
  maintenanceIds: ReadonlyArray<number>,
): Promise<void> {
  for (const id of new Set(maintenanceIds)) {
    await syncDerivedWindow(tx, ctx, id);
  }
}

/**
 * The maintenances reaching these components or monitors. Read it before a
 * change that deletes them: the cascade takes the association rows with it.
 */
export async function maintenanceIdsBehind(
  tx: DB,
  workspaceId: number,
  by: {
    componentIds?: ReadonlyArray<number>;
    monitorIds?: ReadonlyArray<number>;
  },
): Promise<number[]> {
  const componentIds = [...(by.componentIds ?? [])];
  const monitorIds = [...(by.monitorIds ?? [])];
  if (componentIds.length === 0 && monitorIds.length === 0) return [];
  const rows = await tx
    .selectDistinct({ id: maintenancesToPageComponents.maintenanceId })
    .from(maintenancesToPageComponents)
    .innerJoin(
      pageComponent,
      eq(pageComponent.id, maintenancesToPageComponents.pageComponentId),
    )
    .where(
      and(
        eq(pageComponent.workspaceId, workspaceId),
        or(
          componentIds.length > 0
            ? inArray(pageComponent.id, componentIds)
            : undefined,
          monitorIds.length > 0
            ? inArray(pageComponent.monitorId, monitorIds)
            : undefined,
        ),
      ),
    )
    .all();
  return rows.map((r) => r.id);
}
