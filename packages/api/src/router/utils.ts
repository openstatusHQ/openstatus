import { eq } from "@openstatus/db";
import {
  monitor,
  notification,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

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
  ctx,
}: {
  workspaceSlug: string;
  ctx: Context;
}) => {
  if (!ctx.auth?.userId) return;
  const currentUser = ctx.db
    .select()
    .from(user)
    .where(eq(user.tenantId, ctx.auth?.userId))
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
  // the user doesn't have access to this workspace
  if (!result || !result.users_to_workspaces) return;

  const plan = (currentWorkspace.plan || "free") as "free" | "pro"; // FIXME: that is a hotfix

  return {
    workspace: currentWorkspace,
    user: result.currentUser,
    plan: allPlans[plan],
  };
};

export const hasUserAccessToMonitor = async ({
  monitorId,
  ctx,
}: {
  monitorId: number;
  ctx: Context;
}) => {
  if (!ctx.auth?.userId) return;

  const currentMonitor = await ctx.db
    .select()
    .from(monitor)
    .where(eq(monitor.id, monitorId))
    .get();
  if (!currentMonitor || !currentMonitor.workspaceId) return;

  // TODO: we should use hasUserAccess and pass `workspaceId` instead of `workspaceSlug`
  const currentUser = ctx.db
    .select()
    .from(user)
    .where(eq(user.tenantId, ctx.auth.userId))
    .as("currentUser");

  const result = await ctx.db
    .select()
    .from(usersToWorkspaces)
    .where(eq(usersToWorkspaces.workspaceId, currentMonitor.workspaceId))
    .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
    .get();

  if (!result || !result.users_to_workspaces) return;

  const currentWorkspace = await ctx.db.query.workspace.findFirst({
    where: eq(workspace.id, result.users_to_workspaces.workspaceId),
  });

  if (!currentWorkspace) return;
  return {
    workspace: currentWorkspace,
    user: result.currentUser,
    monitor: currentMonitor,
  };
};

export const hasUserAccessToNotification = async ({
  notificationId,
  ctx,
}: {
  notificationId: number;
  ctx: Context;
}) => {
  if (!ctx.auth?.userId) return;

  const currentNotification = await ctx.db
    .select()
    .from(notification)
    .where(eq(notification.id, notificationId))
    .get();
  if (!currentNotification || !currentNotification.workspaceId) return;

  // TODO: we should use hasUserAccess and pass `workspaceId` instead of `workspaceSlug`
  const currentUser = ctx.db
    .select()
    .from(user)
    .where(eq(user.tenantId, ctx.auth.userId))
    .as("currentUser");

  const result = await ctx.db
    .select()
    .from(usersToWorkspaces)
    .where(eq(usersToWorkspaces.workspaceId, currentNotification.workspaceId))
    .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
    .get();

  if (!result || !result.users_to_workspaces) return;

  const currentWorkspace = await ctx.db.query.workspace.findFirst({
    where: eq(workspace.id, result.users_to_workspaces.workspaceId),
  });

  if (!currentWorkspace) return;
  return {
    workspace: currentWorkspace,
    user: result.currentUser,
    notification: currentNotification,
  };
};
