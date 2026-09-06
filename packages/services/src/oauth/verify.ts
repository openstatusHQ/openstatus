import { db as defaultDb, eq } from "@openstatus/db";
import { oauthGrant } from "@openstatus/db/src/schema";
import type { Scope } from "@openstatus/db/src/schema/api-keys/constants";
import { shouldUpdateLastUsed } from "@openstatus/db/src/utils/api-key";

import type { DB } from "../context";
import { ACCESS_TOKEN_PREFIX } from "./constants";
import { sha256Hex } from "./crypto";

export type VerifiedAccessToken = {
  grantId: number;
  workspaceId: number;
  userId: number;
  scopes: Scope[];
};

export function isAccessToken(token: string): boolean {
  return token.startsWith(ACCESS_TOKEN_PREFIX);
}

/**
 * Resolve a bearer access token to its grant. Runs before the workspace is
 * known, so no `ServiceContext`. `last_used_at` is bumped best-effort with the
 * same debounce as API keys.
 */
export async function verifyAccessToken(
  token: string,
  opts: { db?: DB; now?: Date } = {},
): Promise<VerifiedAccessToken | null> {
  if (!isAccessToken(token)) return null;
  const db = opts.db ?? defaultDb;
  const now = opts.now ?? new Date();

  const grant = await db
    .select()
    .from(oauthGrant)
    .where(eq(oauthGrant.accessTokenHash, await sha256Hex(token)))
    .get();
  if (!grant || grant.revokedAt) return null;
  if (grant.accessTokenExpiresAt < now) return null;

  if (shouldUpdateLastUsed(grant.lastUsedAt, undefined, now)) {
    await db
      .update(oauthGrant)
      .set({ lastUsedAt: now })
      .where(eq(oauthGrant.id, grant.id))
      .catch(() => {});
  }

  return {
    grantId: grant.id,
    workspaceId: grant.workspaceId,
    userId: grant.userId,
    scopes: grant.scope,
  };
}
