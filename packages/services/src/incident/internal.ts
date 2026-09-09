import { and, eq } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { NotFoundError } from "../errors";

export async function getIncidentInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(incidentTable)
    .where(
      and(eq(incidentTable.id, id), eq(incidentTable.workspaceId, workspaceId)),
    )
    .get();
  if (!row) throw new NotFoundError("incident", id);
  return row;
}
