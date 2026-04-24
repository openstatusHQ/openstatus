import { and, eq, inArray } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ConflictError, NotFoundError } from "../errors";

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
