import { and, eq } from "@openstatus/db";
import { usersToWorkspaces } from "@openstatus/db/src/schema";
import type { WorkspaceRole } from "@openstatus/db/src/schema";

import type { DB } from "../context";

/** Membership row for (user, workspace), or `undefined` when the user is not a member. */
export async function getMembership(
  db: DB,
  userId: number,
  workspaceId: number,
): Promise<{ role: WorkspaceRole } | undefined> {
  return db
    .select({ role: usersToWorkspaces.role })
    .from(usersToWorkspaces)
    .where(
      and(
        eq(usersToWorkspaces.userId, userId),
        eq(usersToWorkspaces.workspaceId, workspaceId),
      ),
    )
    .get();
}
