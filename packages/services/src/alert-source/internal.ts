import { and, eq } from "@openstatus/db";
import { alertSource } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { NotFoundError } from "../errors";

export async function getAlertSourceInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(alertSource)
    .where(
      and(eq(alertSource.id, id), eq(alertSource.workspaceId, workspaceId)),
    )
    .get();
  if (!row) throw new NotFoundError("alert source", id);
  return row;
}
