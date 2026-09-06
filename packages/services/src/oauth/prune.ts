import {
  and,
  db as defaultDb,
  eq,
  gt,
  isNull,
  lt,
  notExists,
} from "@openstatus/db";
import {
  oauthAuthorizationCode,
  oauthClient,
  oauthGrant,
  oauthSession,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { withBusyRetry } from "../retry";
import { CLIENT_PRUNE_AFTER_MS } from "./constants";

export type PruneExpiredResult = {
  sessions: number;
  codes: number;
  grants: number;
  clients: number;
};

/**
 * Daily cleanup. Clients that never completed a consent go after seven days;
 * clients with a grant row are kept forever because Claude.ai caches the
 * `client_id` and never re-registers.
 */
export async function pruneExpired(
  args: {
    ctx?: { db?: DB };
    now?: Date;
  } = {},
): Promise<PruneExpiredResult> {
  const db = args.ctx?.db ?? defaultDb;
  const now = args.now ?? new Date();
  const clientCutoff = new Date(now.getTime() - CLIENT_PRUNE_AFTER_MS);

  return withBusyRetry(async () => {
    const sessions = await db
      .delete(oauthSession)
      .where(lt(oauthSession.expiresAt, now))
      .returning({ id: oauthSession.id })
      .all();
    const codes = await db
      .delete(oauthAuthorizationCode)
      .where(lt(oauthAuthorizationCode.expiresAt, now))
      .returning({ id: oauthAuthorizationCode.id })
      .all();
    const grants = await db
      .update(oauthGrant)
      .set({ revokedAt: now })
      .where(
        and(
          isNull(oauthGrant.revokedAt),
          lt(oauthGrant.refreshTokenExpiresAt, now),
        ),
      )
      .returning({ id: oauthGrant.id })
      .all();
    const clients = await db
      .delete(oauthClient)
      .where(
        and(
          lt(oauthClient.createdAt, clientCutoff),
          notExists(
            db
              .select({ id: oauthGrant.id })
              .from(oauthGrant)
              .where(eq(oauthGrant.clientId, oauthClient.clientId)),
          ),
          notExists(
            db
              .select({ id: oauthSession.id })
              .from(oauthSession)
              .where(
                and(
                  eq(oauthSession.clientId, oauthClient.clientId),
                  gt(oauthSession.expiresAt, now),
                ),
              ),
          ),
        ),
      )
      .returning({ id: oauthClient.id })
      .all();

    return {
      sessions: sessions.length,
      codes: codes.length,
      grants: grants.length,
      clients: clients.length,
    };
  });
}
