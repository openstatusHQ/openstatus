import { and, db as defaultDb, eq } from "@openstatus/db";
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

/** Rotate in place; `where refresh_token_hash = expected` makes concurrent refreshes lose cleanly. */
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
      ),
    )
    .returning();
  return updated ? toTokenResponse(updated, tokens) : null;
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

  const current = await db
    .select()
    .from(oauthGrant)
    .where(eq(oauthGrant.refreshTokenHash, hash))
    .get();
  if (current) {
    if (current.clientId !== client.clientId || current.revokedAt) {
      throw invalidGrant("Invalid refresh token");
    }
    if (current.refreshTokenExpiresAt < now) {
      await revokeGrantAsOwner(db, current, "refresh_reuse", now);
      throw invalidGrant("Refresh token expired");
    }
    const rotated = await rotate(db, current, hash, now);
    if (rotated) return rotated;
  }

  const previous = await db
    .select()
    .from(oauthGrant)
    .where(eq(oauthGrant.previousRefreshTokenHash, hash))
    .get();
  if (
    !previous ||
    previous.clientId !== client.clientId ||
    previous.revokedAt
  ) {
    throw invalidGrant("Invalid refresh token");
  }
  const insideGrace =
    previous.rotatedAt !== null &&
    now.getTime() - previous.rotatedAt.getTime() <= REFRESH_GRACE_MS;
  if (!insideGrace) {
    await revokeGrantAsOwner(db, previous, "refresh_reuse", now);
    throw invalidGrant("Refresh token reused; grant revoked");
  }
  const rotated = await rotate(db, previous, previous.refreshTokenHash, now);
  if (!rotated) throw invalidGrant("Invalid refresh token");
  return rotated;
}
