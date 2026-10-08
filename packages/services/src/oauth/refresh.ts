import { and, db as defaultDb, eq, isNull, or } from "@openstatus/db";
import { oauthGrant } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { REFRESH_GRACE_MS } from "./constants";
import { sha256Hex } from "./crypto";
import { OAuthError } from "./errors";
import {
  getLiveClient,
  mintTokens,
  revokeGrantAsOwner,
  toTokenResponse,
} from "./internal";
import { RefreshGrantInput, type TokenResponse } from "./schemas";

type GrantRow = typeof oauthGrant.$inferSelect;

const invalidGrant = (message: string) =>
  new OAuthError("invalid_grant", message);

/**
 * Rotate in place. The predicate pins the hash being replaced and the live
 * state, so a concurrent refresh or revoke makes this match nothing.
 */
async function rotate(
  db: DB,
  grant: GrantRow,
  expectedCurrentHash: string,
  now: Date,
): Promise<TokenResponse | null> {
  const tokens = await mintTokens(now);
  const [updated] = await db
    .update(oauthGrant)
    .set({
      accessTokenHash: tokens.accessTokenHash,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenHash: tokens.refreshTokenHash,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      previousRefreshTokenHash: expectedCurrentHash,
      rotatedAt: now,
      lastUsedAt: now,
    })
    .where(
      and(
        eq(oauthGrant.id, grant.id),
        eq(oauthGrant.refreshTokenHash, expectedCurrentHash),
        isNull(oauthGrant.revokedAt),
      ),
    )
    .returning();
  return updated ? toTokenResponse(updated, tokens) : null;
}

function insideGrace(grant: GrantRow, now: Date): boolean {
  return (
    grant.rotatedAt !== null &&
    now.getTime() - grant.rotatedAt.getTime() <= REFRESH_GRACE_MS
  );
}

/**
 * `grant_type=refresh_token`. The hash rotated out most recently stays valid
 * for a short grace window and rotates again; presenting it after the window
 * is treated as theft and revokes the grant.
 */
export async function refreshGrant(args: {
  input: RefreshGrantInput;
  db?: DB;
  now?: Date;
}): Promise<TokenResponse> {
  const input = RefreshGrantInput.parse(args.input);
  const db = args.db ?? defaultDb;
  const now = args.now ?? new Date();

  const client = await getLiveClient(db, input.clientId);
  const hash = await sha256Hex(input.refreshToken);

  const load = () =>
    db
      .select()
      .from(oauthGrant)
      .where(
        or(
          eq(oauthGrant.refreshTokenHash, hash),
          eq(oauthGrant.previousRefreshTokenHash, hash),
        ),
      )
      .get();

  let grant = await load();
  if (!grant || grant.clientId !== client.clientId || grant.revokedAt) {
    throw invalidGrant("Invalid refresh token");
  }

  if (grant.refreshTokenHash === hash) {
    if (grant.refreshTokenExpiresAt < now) {
      await revokeGrantAsOwner(db, grant, "refresh_reuse", now);
      throw invalidGrant("Refresh token expired");
    }
    const rotated = await rotate(db, grant, hash, now);
    if (rotated) return rotated;
    // Lost a race: either a concurrent refresh moved this hash to
    // `previous`, or a revoke landed. Re-read and fall through.
    grant = await load();
    if (!grant || grant.revokedAt || grant.previousRefreshTokenHash !== hash) {
      throw invalidGrant("Invalid refresh token");
    }
  }

  if (!insideGrace(grant, now)) {
    await revokeGrantAsOwner(db, grant, "refresh_reuse", now);
    throw invalidGrant("Refresh token reused; grant revoked");
  }
  const rotated = await rotate(db, grant, grant.refreshTokenHash, now);
  if (!rotated) throw invalidGrant("Invalid refresh token");
  return rotated;
}
