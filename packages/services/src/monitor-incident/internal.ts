import { and, eq } from "@openstatus/db";
import { monitorIncidentTable } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { NotFoundError } from "../errors";

/** Load a monitor incident by id, scoped to the workspace. Throws on miss. */
export async function getMonitorIncidentInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(monitorIncidentTable)
    .where(
      and(
        eq(monitorIncidentTable.id, id),
        eq(monitorIncidentTable.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("monitor incident", id);
  return row;
}
