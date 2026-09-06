import { and, db as defaultDb, eq, isNull, or } from "@openstatus/db";
import { oauthGrant } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import {
  type DB,
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors";
import { getMembership } from "../member/membership";
import { sha256Hex } from "./crypto";
import { getLiveClient, revokeGrantAsOwner, revokeGrantRows } from "./internal";
import { RevokeGrantInput, RevokeTokenInput } from "./schemas";

/**
 * Connected apps → Revoke. Any member revokes their own grants; owners and
 * admins revoke any grant in the workspace.
 */
// Delegates the audit row to `revokeGrantRows`.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function revokeGrant(args: {
  ctx: ServiceContext;
  input: RevokeGrantInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = RevokeGrantInput.parse(args.input);

  const actorUserId = tryGetActorUserId(ctx.actor);
  if (actorUserId == null) {
    throw new UnauthorizedError(
      "Grants can only be revoked by a known user actor.",
    );
  }

  await withTransaction(ctx, async (tx) => {
    const grant = await tx
      .select()
      .from(oauthGrant)
      .where(
        and(
          eq(oauthGrant.id, input.grantId),
          eq(oauthGrant.workspaceId, ctx.workspace.id),
          isNull(oauthGrant.revokedAt),
        ),
      )
      .get();
    if (!grant) throw new NotFoundError("oauth_grant", input.grantId);

    if (grant.userId !== actorUserId) {
      const membership = await getMembership(tx, actorUserId, ctx.workspace.id);
      if (membership?.role !== "owner" && membership?.role !== "admin") {
        throw new ForbiddenError(
          "Only owners and admins can revoke other members' grants",
        );
      }
    }

    await revokeGrantRows(tx, ctx, [grant], "manual");
  });
}

/**
 * Internal: revoke every live grant of a user, in one workspace (member
 * removal) or everywhere (account deletion). Runs inside the caller's tx.
 */
export async function revokeGrantsForUser(args: {
  tx: DB;
  ctx: ServiceContext;
  userId: number;
  workspaceId?: number;
  reason?: "member_removed" | "account_deleted";
}): Promise<number> {
  const { tx, ctx, userId } = args;
  const clauses = [eq(oauthGrant.userId, userId), isNull(oauthGrant.revokedAt)];
  if (args.workspaceId !== undefined) {
    clauses.push(eq(oauthGrant.workspaceId, args.workspaceId));
  }
  const grants = await tx
    .select()
    .from(oauthGrant)
    .where(and(...clauses))
    .all();
  if (grants.length === 0) return 0;
  return revokeGrantRows(
    tx,
    ctx,
    grants,
    args.reason ??
      (args.workspaceId !== undefined ? "member_removed" : "account_deleted"),
  );
}

/** RFC 7009: either token of a grant revokes the whole grant. Unknown tokens are a silent no-op. */
export async function revokeToken(args: {
  input: RevokeTokenInput;
  db?: DB;
  now?: Date;
}): Promise<void> {
  const input = RevokeTokenInput.parse(args.input);
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();

  const client = await getLiveClient(db, input.clientId);
  const hash = await sha256Hex(input.token);
  const grant = await db
    .select()
    .from(oauthGrant)
    .where(
      and(
        eq(oauthGrant.clientId, client.clientId),
        isNull(oauthGrant.revokedAt),
        or(
          eq(oauthGrant.accessTokenHash, hash),
          eq(oauthGrant.refreshTokenHash, hash),
          eq(oauthGrant.previousRefreshTokenHash, hash),
        ),
      ),
    )
    .get();
  if (!grant) return;
  await revokeGrantAsOwner(db, grant, "token_revoked", now);
}
