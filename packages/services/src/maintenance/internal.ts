import { and, eq, inArray } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ConflictError, NotFoundError } from "../errors";
import type { PageComponent } from "../types";

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

  const ids = Array.from(pageComponentIds);
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

/** Fetch the associated component ids for a maintenance. */
export async function getPageComponentIdsForMaintenance(
  tx: DB,
  maintenanceId: number,
): Promise<number[]> {
  const rows = await tx
    .select({ pageComponentId: maintenancesToPageComponents.pageComponentId })
    .from(maintenancesToPageComponents)
    .where(eq(maintenancesToPageComponents.maintenanceId, maintenanceId))
    .all();
  return rows.map((r) => r.pageComponentId);
}

/** Fetch the full associated component rows for a maintenance. */
export async function getPageComponentsForMaintenance(
  tx: DB,
  maintenanceId: number,
): Promise<PageComponent[]> {
  const rows = await tx
    .select()
    .from(pageComponent)
    .innerJoin(
      maintenancesToPageComponents,
      eq(maintenancesToPageComponents.pageComponentId, pageComponent.id),
    )
    .where(eq(maintenancesToPageComponents.maintenanceId, maintenanceId))
    .all();
  return rows.map((r) => r.page_component as unknown as PageComponent);
}
