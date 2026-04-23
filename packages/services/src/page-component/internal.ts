import { and, eq, inArray } from "@openstatus/db";
import { monitor, page } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ForbiddenError } from "../errors";

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
  const rows = await tx
    .select({ id: monitor.id })
    .from(monitor)
    .where(and(inArray(monitor.id, ids), eq(monitor.workspaceId, workspaceId)))
    .all();
  if (rows.length !== ids.length) {
    throw new ForbiddenError("Invalid monitor IDs.");
  }
}
