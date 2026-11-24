import type { DB } from "../context";
import { ForbiddenError } from "../errors";
import { findMissingMonitorId } from "../monitor/internal";

/**
 * Ensure every id in `monitorIds` belongs to the given workspace and is not
 * soft-deleted. No-op when the list is empty. Throws `ForbiddenError` (not
 * `NotFound`) to match the legacy router's `FORBIDDEN` response — surfacing
 * "this id doesn't exist" vs. "this id isn't yours" would leak workspace
 * state.
 */
export async function assertMonitorsInWorkspace(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: number[];
}): Promise<void> {
  const missing = await findMissingMonitorId({
    tx: args.tx,
    workspaceId: args.workspaceId,
    ids: args.monitorIds,
  });
  if (missing !== undefined) {
    throw new ForbiddenError("Invalid monitor IDs.");
  }
}
