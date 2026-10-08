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
import { CLIENT_PRUNE_AFTER_MS } from "./constants";
import { loadWorkspace, revokeGrantRows, runTx } from "./internal";

export type PruneExpiredResult = {
  sessions: number;
  codes: number;
  grants: number;
  clients: number;
};

/**
 * Daily cleanup, one transaction. Clients that never completed a consent go
 * after seven days; clients with a grant row are kept forever because
 * Claude.ai caches the `client_id` and never re-registers.
 */
export async function pruneExpired(
  args: { ctx?: { db?: DB }; now?: Date } = {},
): Promise<PruneExpiredResult> {
  const now = args.now ?? new Date();
  const clientCutoff = new Date(now.getTime() - CLIENT_PRUNE_AFTER_MS);

  return runTx(args.ctx?.db ?? defaultDb, async (tx) => {
    const sessions = await tx
      .delete(oauthSession)
      .where(lt(oauthSession.expiresAt, now))
      .run();
    const codes = await tx
      .delete(oauthAuthorizationCode)
      .where(lt(oauthAuthorizationCode.expiresAt, now))
      .run();

    // Refresh expiry is a revocation like any other and is audited as one,
    // under the system actor.
    const expired = await tx
      .select()
      .from(oauthGrant)
      .where(
        and(
          isNull(oauthGrant.revokedAt),
          lt(oauthGrant.refreshTokenExpiresAt, now),
        ),
      )
      .all();
    let grants = 0;
    if (expired.length > 0) {
      const workspace = await loadWorkspace(tx, expired[0].workspaceId);
      grants = await revokeGrantRows(
        tx,
        { workspace, actor: { type: "system", job: "oauth-prune" }, db: tx },
        expired,
        "expired",
        now,
      );
    }

    // A client is dead weight only when nothing can still turn into a grant:
    // no grant ever, no live session, no unconsumed code.
    const clients = await tx
      .delete(oauthClient)
      .where(
        and(
          lt(oauthClient.createdAt, clientCutoff),
          notExists(
            tx
              .select({ id: oauthGrant.id })
              .from(oauthGrant)
              .where(eq(oauthGrant.clientId, oauthClient.clientId)),
          ),
          notExists(
            tx
              .select({ id: oauthSession.id })
              .from(oauthSession)
              .where(eq(oauthSession.clientId, oauthClient.clientId)),
          ),
          notExists(
            tx
              .select({ id: oauthAuthorizationCode.id })
              .from(oauthAuthorizationCode)
              .where(
                and(
                  eq(oauthAuthorizationCode.clientId, oauthClient.clientId),
                  isNull(oauthAuthorizationCode.consumedAt),
                  gt(oauthAuthorizationCode.expiresAt, now),
                ),
              ),
          ),
        ),
      )
      .run();

    return {
      sessions: sessions.rowsAffected,
      codes: codes.rowsAffected,
      grants,
      clients: clients.rowsAffected,
    };
  });
}
