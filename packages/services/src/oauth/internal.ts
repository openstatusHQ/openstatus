import { and, db as defaultDb, eq, isNull } from "@openstatus/db";
import {
  type OAuthClient,
  type OAuthGrant,
  type Workspace,
  oauthClient,
  oauthGrant,
  selectOAuthClientSchema,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import type { Scope } from "@openstatus/db/src/schema/api-keys/constants";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type DB,
  type ServiceContext,
  isTx,
  withTransaction,
} from "../context";
import { withBusyRetry } from "../retry";
import {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_MS,
} from "./constants";
import { randomBase64Url, sha256Hex } from "./crypto";
import { OAuthError } from "./errors";
import { type TokenResponse, formatScope } from "./schemas";

export type GrantRevokeReason =
  | "expired"
  | "manual"
  | "re_consent"
  | "code_reuse"
  | "refresh_reuse"
  | "member_removed"
  | "account_deleted"
  | "token_revoked";

export async function getLiveClient(
  db: DB,
  clientId: string,
): Promise<OAuthClient> {
  const row = await db
    .select()
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
    .get();
  if (!row || row.revokedAt) {
    throw new OAuthError("invalid_client", "Unknown or revoked client");
  }
  return selectOAuthClientSchema.parse(row);
}

export async function loadWorkspace(
  db: DB,
  workspaceId: number,
): Promise<Workspace> {
  const row = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .get();
  if (!row) throw new OAuthError("invalid_grant", "Workspace no longer exists");
  return selectWorkspaceSchema.parse(row);
}

/** Pre-workspace verbs have no `ServiceContext`; this is `withTransaction` for them. */
export async function runTx<T>(
  db: DB | undefined,
  fn: (tx: DB) => Promise<T>,
): Promise<T> {
  const conn = db ?? defaultDb;
  if (isTx(conn)) return fn(conn);
  return withBusyRetry(() => (conn as typeof defaultDb).transaction(fn));
}

/** Audit snapshot without token hashes. */
export function grantSnapshot(
  grant: OAuthGrant | typeof oauthGrant.$inferSelect,
) {
  return {
    id: grant.id,
    clientId: grant.clientId,
    workspaceId: grant.workspaceId,
    userId: grant.userId,
    scope: grant.scope,
    createdAt: grant.createdAt,
    lastUsedAt: grant.lastUsedAt,
    revokedAt: grant.revokedAt,
  };
}

export type MintedTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenHash: string;
  refreshTokenHash: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

export async function mintTokens(now: Date): Promise<MintedTokens> {
  const accessToken = `${ACCESS_TOKEN_PREFIX}${randomBase64Url(32)}`;
  const refreshToken = randomBase64Url(32);
  return {
    accessToken,
    refreshToken,
    accessTokenHash: await sha256Hex(accessToken),
    refreshTokenHash: await sha256Hex(refreshToken),
    accessTokenExpiresAt: new Date(
      now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000,
    ),
    refreshTokenExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
  };
}

export function toTokenResponse(
  grant: { scope: readonly Scope[] },
  tokens: Pick<MintedTokens, "accessToken" | "refreshToken">,
): TokenResponse {
  return {
    access_token: tokens.accessToken,
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: tokens.refreshToken,
    scope: formatScope(grant.scope),
  };
}

/**
 * Stamp `revoked_at` and emit `oauth_grant.delete` for each live row. A grant
 * that belongs to another workspace than `ctx.workspace` (re-consent after a
 * workspace switch, account deletion) is audited under its own workspace.
 */
export async function revokeGrantRows(
  tx: DB,
  ctx: ServiceContext,
  grants: ReadonlyArray<typeof oauthGrant.$inferSelect>,
  reason: GrantRevokeReason,
  now: Date = new Date(),
): Promise<number> {
  const workspaces = new Map<number, Workspace>([
    [ctx.workspace.id, ctx.workspace],
  ]);
  let revoked = 0;
  for (const grant of grants) {
    if (grant.revokedAt) continue;
    // Only the live-to-revoked transition is audited; a racing revoke
    // matches nothing here.
    const [row] = await tx
      .update(oauthGrant)
      .set({ revokedAt: now })
      .where(and(eq(oauthGrant.id, grant.id), isNull(oauthGrant.revokedAt)))
      .returning();
    if (!row) continue;
    revoked += 1;

    let ws = workspaces.get(grant.workspaceId);
    if (!ws) {
      ws = await loadWorkspace(tx, grant.workspaceId);
      workspaces.set(grant.workspaceId, ws);
    }
    await emitAudit(
      tx,
      { ...ctx, workspace: ws, db: tx },
      {
        action: "oauth_grant.delete",
        entityType: "oauth_grant",
        entityId: grant.id,
        before: grantSnapshot(grant),
        metadata: { reason },
      },
    );
  }
  return revoked;
}

/**
 * Revoke outside a workspace-scoped verb: builds the consenting user's context
 * from the grant so the audit row still attributes to them.
 */
// Delegates the audit row to `revokeGrantRows`.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function revokeGrantAsOwner(
  db: DB,
  grant: typeof oauthGrant.$inferSelect,
  reason: GrantRevokeReason,
  now: Date,
): Promise<void> {
  const workspace = await loadWorkspace(db, grant.workspaceId);
  const ctx: ServiceContext = {
    workspace,
    actor: { type: "user", userId: grant.userId },
    db,
  };
  requireScope(ctx, "write");
  await withTransaction(ctx, (tx) =>
    revokeGrantRows(tx, ctx, [grant], reason, now),
  );
}
