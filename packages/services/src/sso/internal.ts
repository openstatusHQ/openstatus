import { and, eq, isNotNull } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  usersToWorkspaces,
  workspace,
  workspaceSsoDomain,
} from "@openstatus/db/src/schema";

import {
  type DB,
  type ServiceContext,
  getReadDb,
  tryGetActorUserId,
} from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import type { Workspace } from "../types";

export async function requireOwner(tx: DB, ctx: ServiceContext): Promise<void> {
  if (ctx.actor.type === "system") return;

  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new ForbiddenError("Only workspace owners can manage SSO");
  }

  const membership = await tx.query.usersToWorkspaces.findFirst({
    where: and(
      eq(usersToWorkspaces.userId, userId),
      eq(usersToWorkspaces.workspaceId, ctx.workspace.id),
    ),
  });

  if (!membership || membership.role !== "owner") {
    throw new ForbiddenError("Only workspace owners can manage SSO");
  }
}

export async function getWorkspaceByWorkosOrganization(
  db: DB,
  organizationId: string,
): Promise<Workspace> {
  const row = await db
    .select()
    .from(workspace)
    .where(eq(workspace.workosOrganizationId, organizationId))
    .get();

  if (!row) throw new NotFoundError("workspace", organizationId);

  return selectWorkspaceSchema.parse(row);
}

export async function listSsoDomains(ctx: ServiceContext) {
  return getReadDb(ctx)
    .select()
    .from(workspaceSsoDomain)
    .where(eq(workspaceSsoDomain.workspaceId, ctx.workspace.id))
    .all();
}

export async function hasVerifiedDomain(
  db: DB,
  workspaceId: number,
): Promise<boolean> {
  const row = await db
    .select({ id: workspaceSsoDomain.id })
    .from(workspaceSsoDomain)
    .where(
      and(
        eq(workspaceSsoDomain.workspaceId, workspaceId),
        isNotNull(workspaceSsoDomain.verifiedAt),
      ),
    )
    .get();

  return Boolean(row);
}
