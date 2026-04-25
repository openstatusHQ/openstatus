import { and, eq, inArray } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ForbiddenError } from "../errors";

/**
 * Ensure every id in `monitorIds` belongs to the given workspace. No-op
 * when the list is empty. Throws `ForbiddenError` (not `NotFound`) to
 * match the legacy router's `FORBIDDEN` response — surfacing "this id
 * doesn't exist" vs. "this id isn't yours" would leak workspace state.
 */
export async function assertMonitorsInWorkspace(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: number[];
}): Promise<void> {
  const { tx, workspaceId, monitorIds } = args;
  if (monitorIds.length === 0) return;

  const uniqueIds = Array.from(new Set(monitorIds));

  const valid = await tx.query.monitor.findMany({
    where: and(
      eq(monitor.workspaceId, workspaceId),
      inArray(monitor.id, uniqueIds),
    ),
  });
  if (valid.length !== uniqueIds.length) {
    throw new ForbiddenError("Invalid monitor IDs.");
  }
}
