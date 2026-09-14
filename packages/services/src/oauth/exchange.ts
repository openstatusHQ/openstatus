import { and, db as defaultDb, eq, isNull } from "@openstatus/db";
import {
  oauthAuthorizationCode,
  oauthGrant,
  user,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { InternalServiceError } from "../errors";
import { getMembership } from "../member/membership";
import { sha256Hex, verifyPkce } from "./crypto";
import { OAuthError } from "./errors";
import {
  getLiveClient,
  grantSnapshot,
  loadWorkspace,
  mintTokens,
  revokeGrantRows,
  toTokenResponse,
} from "./internal";
import { ExchangeCodeInput, type TokenResponse } from "./schemas";

const invalidGrant = (message: string) =>
  new OAuthError("invalid_grant", message);

/**
 * `grant_type=authorization_code`. Consumes the code once, revokes the user's
 * other live grants for this client (one install, one token store) and mints
 * the grant. A replayed code revokes the grant it produced.
 */
export async function exchangeCode(args: {
  input: ExchangeCodeInput;
  db?: DB;
  now?: Date;
}): Promise<TokenResponse> {
  const input = ExchangeCodeInput.parse(args.input);
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();

  const client = await getLiveClient(db, input.clientId);
  const hash = await sha256Hex(input.code);
  const code = await db
    .select()
    .from(oauthAuthorizationCode)
    .where(eq(oauthAuthorizationCode.hash, hash))
    .get();
  if (!code || code.clientId !== client.clientId) {
    throw invalidGrant("Invalid authorization code");
  }

  const workspace = await loadWorkspace(db, code.workspaceId);
  const ctx: ServiceContext = {
    workspace,
    actor: { type: "user", userId: code.userId },
    db,
  };
  requireScope(ctx, "write");

  if (code.consumedAt) {
    if (code.grantId !== null) {
      const grantId = code.grantId;
      await withTransaction(ctx, async (tx) => {
        const grant = await tx
          .select()
          .from(oauthGrant)
          .where(eq(oauthGrant.id, grantId))
          .get();
        if (grant) await revokeGrantRows(tx, ctx, [grant], "code_reuse", now);
      });
    }
    throw invalidGrant("Authorization code already used");
  }
  if (code.expiresAt < now) throw invalidGrant("Authorization code expired");
  if (code.redirectUri !== input.redirectUri) {
    throw invalidGrant("redirect_uri does not match the authorization request");
  }
  if (!(await verifyPkce(input.codeVerifier, code.codeChallenge))) {
    throw invalidGrant("PKCE verification failed");
  }

  const tokens = await mintTokens(now);

  return withTransaction(ctx, async (tx) => {
    // Consent can be minutes old: the member may have been removed or the
    // account deleted in between, and pending codes are not invalidated then.
    const membership = await getMembership(tx, code.userId, code.workspaceId);
    const owner = await tx
      .select({ deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.id, code.userId))
      .get();
    if (!membership || !owner || owner.deletedAt) {
      throw invalidGrant("The consenting user no longer has access");
    }

    const others = await tx
      .select()
      .from(oauthGrant)
      .where(
        and(
          eq(oauthGrant.clientId, client.clientId),
          eq(oauthGrant.userId, code.userId),
          isNull(oauthGrant.revokedAt),
        ),
      )
      .all();
    await revokeGrantRows(tx, ctx, others, "re_consent", now);

    const [grant] = await tx
      .insert(oauthGrant)
      .values({
        clientId: client.clientId,
        userId: code.userId,
        workspaceId: code.workspaceId,
        scope: code.scope,
        accessTokenHash: tokens.accessTokenHash,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenHash: tokens.refreshTokenHash,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      })
      .returning();
    if (!grant) throw new InternalServiceError("Failed to create OAuth grant");

    // Single conditional write: a concurrent exchange that consumed the code
    // first makes this match nothing, and the throw rolls the grant back.
    const [consumed] = await tx
      .update(oauthAuthorizationCode)
      .set({ consumedAt: now, grantId: grant.id })
      .where(
        and(
          eq(oauthAuthorizationCode.id, code.id),
          isNull(oauthAuthorizationCode.consumedAt),
        ),
      )
      .returning({ id: oauthAuthorizationCode.id });
    if (!consumed) throw invalidGrant("Authorization code already used");

    await emitAudit(tx, ctx, {
      action: "oauth_grant.create",
      entityType: "oauth_grant",
      entityId: grant.id,
      after: grantSnapshot(grant),
      metadata: { clientName: client.name, scope: grant.scope },
    });

    return toTokenResponse(grant, tokens);
  });
}
