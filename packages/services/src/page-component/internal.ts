import { and, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";

/** Assert a page is in the workspace. Throws `ForbiddenError` otherwise. */
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
  if (!row) throw new ForbiddenError("You don't have access to this page.");
}

/** Load a component by id, scoped to the workspace. */
export async function getPageComponentInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(pageComponent)
    .where(
      and(eq(pageComponent.id, id), eq(pageComponent.workspaceId, workspaceId)),
    )
    .get();
  if (!row) throw new NotFoundError("page_component", id);
  return row;
}

/**
 * Assert a group exists and sits on `pageId`. Workspace scope alone isn't
 * enough — a group from a sibling page would otherwise be accepted and the
 * component would render under a group it isn't on. Reported as not-found
 * so the check doesn't confirm the group exists on another page.
 */
export async function assertGroupOnPage(args: {
  tx: DB;
  groupId: number;
  pageId: number;
  workspaceId: number;
}): Promise<void> {
  const { tx, groupId, pageId, workspaceId } = args;
  const row = await tx
    .select({ pageId: pageComponentGroup.pageId })
    .from(pageComponentGroup)
    .where(
      and(
        eq(pageComponentGroup.id, groupId),
        eq(pageComponentGroup.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!row || row.pageId !== pageId) {
    throw new NotFoundError("page_component_group", groupId);
  }
}

/**
 * Verify the supplied monitor ids all belong to the workspace. Duplicated
 * from `monitor/internal.ts` deliberately; a shared `packages/services/src/
 * internal/` extraction is a natural follow-up once a third consumer
 * appears (tags-to-workspace may be a candidate).
 */
export async function validateMonitorIds(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: ReadonlyArray<number>;
}): Promise<void> {
  const { tx, workspaceId, monitorIds } = args;
  if (monitorIds.length === 0) return;
  const ids = Array.from(new Set(monitorIds));
  // Exclude soft-deleted monitors — a deleted monitor's id shouldn't be
  // attachable to a fresh page component. Without this filter the row
  // count matches on ids pointing at rows that are already tombstoned.
  const rows = await tx
    .select({ id: monitor.id })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, ids),
        eq(monitor.workspaceId, workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .all();
  if (rows.length !== ids.length) {
    throw new ForbiddenError("Invalid monitor IDs.");
  }
}
