import { and, eq } from "@openstatus/db";
import { pageComponentGroup } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { NotFoundError } from "../errors";

/** Load a group by id, scoped to the workspace. */
export async function getGroupInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(pageComponentGroup)
    .where(
      and(
        eq(pageComponentGroup.id, id),
        eq(pageComponentGroup.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("page_component_group", id);
  return row;
}
