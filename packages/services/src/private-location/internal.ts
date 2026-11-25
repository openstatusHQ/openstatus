import type { DB } from "../context";
import { NotFoundError } from "../errors";
import { findMissingMonitorId } from "../monitor/internal";

/** Throws `NotFoundError` for the first id that is not a live monitor of the workspace. */
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
  if (missing !== undefined) throw new NotFoundError("monitor", missing);
}
