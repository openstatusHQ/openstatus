import { eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

import { Context } from "../trpc";

/**
 * Check if the user has access to the workspace, and return the workspace  and user  otherwise undefined
 * @param  workspaceSlug
 * @param  tenantId
 * @param  ctx - trpc context
 * @returns {Promise<{ workspaceId: string; userId: string }> | undefined} - workspaceId and userId
 */
export const hasUserAccessToWorkspace = async ({
  workspaceSlug,
  tenantId,
  ctx,
}: {
  workspaceSlug: string;
  tenantId: string;
  ctx: Context;
}) => {
  const currentUser = ctx.db
    .select()
    .from(user)
    .where(eq(user.tenantId, tenantId))
    .as("currentUser");

  const currentWorkspace = await ctx.db
    .select()
    .from(workspace)
    .where(eq(workspace.slug, workspaceSlug))
    .get();
  if (!currentWorkspace) return;
  const result = await ctx.db
    .select()
    .from(usersToWorkspaces)
    .where(eq(usersToWorkspaces.workspaceId, currentWorkspace.id))
    .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
    .get();
  // the user don't have access to this workspace
  if (!result || !result.users_to_workspaces) return;

  return { workspace: currentWorkspace, user: result.currentUser };
};
