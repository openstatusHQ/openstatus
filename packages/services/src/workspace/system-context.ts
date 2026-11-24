import { db as defaultDb, eq } from "@openstatus/db";
import { selectWorkspaceSchema, workspace } from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import { NotFoundError } from "../errors";

/** A system job acting on a workspace; throws when the workspace is gone. */
export async function systemContext(
  workspaceId: number | null,
  job: string,
  db: DB = defaultDb,
): Promise<ServiceContext> {
  const row =
    workspaceId === null
      ? undefined
      : await db
          .select()
          .from(workspace)
          .where(eq(workspace.id, workspaceId))
          .get();
  if (!row) throw new NotFoundError("workspace", workspaceId ?? "null");
  return {
    workspace: selectWorkspaceSchema.parse(row),
    actor: { type: "system", job },
  };
}
