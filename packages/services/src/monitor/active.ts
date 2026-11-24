import { and, db as defaultDb, eq, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import type { DB } from "../context";

function activeIn(workspaceId: number) {
  return and(
    eq(monitor.workspaceId, workspaceId),
    eq(monitor.active, true),
    isNull(monitor.deletedAt),
  );
}

/** Active, non-deleted monitors of a workspace; for system jobs with no actor. */
export async function countActiveMonitors(args: {
  workspaceId: number;
  db?: DB;
}): Promise<number> {
  return (args.db ?? defaultDb).$count(monitor, activeIn(args.workspaceId));
}

/** Ids of the monitors `countActiveMonitors` counts. */
export async function listActiveMonitorIds(args: {
  workspaceId: number;
  db?: DB;
}): Promise<number[]> {
  const rows = await (args.db ?? defaultDb)
    .select({ id: monitor.id })
    .from(monitor)
    .where(activeIn(args.workspaceId))
    .all();
  return rows.map((r) => r.id);
}
