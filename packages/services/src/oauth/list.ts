import { and, eq, gt, isNull } from "@openstatus/db";
import { oauthClient, oauthGrant, user } from "@openstatus/db/src/schema";
import type { Scope } from "@openstatus/db/src/schema/api-keys/constants";

import { type ServiceContext, getReadDb } from "../context";

export type ConnectedApp = {
  id: number;
  clientId: string;
  clientName: string;
  scope: Scope[];
  userId: number;
  user: {
    id: number;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  createdAt: Date | null;
  lastUsedAt: Date | null;
};

/** Live grants for the workspace, joined with client and consenting user. Hashes never leave the row. */
export async function listGrants(args: {
  ctx: ServiceContext;
  now?: Date;
}): Promise<ConnectedApp[]> {
  const { ctx } = args;
  const db = getReadDb(ctx);
  const now = args.now ?? new Date();

  const rows = await db
    .select({
      id: oauthGrant.id,
      clientId: oauthGrant.clientId,
      clientName: oauthClient.name,
      scope: oauthGrant.scope,
      userId: oauthGrant.userId,
      createdAt: oauthGrant.createdAt,
      lastUsedAt: oauthGrant.lastUsedAt,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    })
    .from(oauthGrant)
    .innerJoin(oauthClient, eq(oauthClient.clientId, oauthGrant.clientId))
    .leftJoin(user, eq(user.id, oauthGrant.userId))
    .where(
      and(
        eq(oauthGrant.workspaceId, ctx.workspace.id),
        isNull(oauthGrant.revokedAt),
        gt(oauthGrant.refreshTokenExpiresAt, now),
      ),
    )
    .orderBy(oauthGrant.createdAt)
    .all();

  return rows.map((row) => ({ ...row, user: row.user?.id ? row.user : null }));
}
