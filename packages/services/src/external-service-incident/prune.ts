import { and, db as defaultDb, isNotNull, lt } from "@openstatus/db";
import { externalServiceIncident } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { withBusyRetry } from "../retry";

const DEFAULT_RAW_PAYLOAD_TTL_DAYS = 90;

export type PruneRawPayloadsResult = {
  purged: number;
};

export async function pruneStaleRawPayloads(args: {
  ctx?: { db?: DB };
  olderThanDays?: number;
  now?: Date;
}): Promise<PruneRawPayloadsResult> {
  const { ctx } = args;
  const olderThanDays = args.olderThanDays ?? DEFAULT_RAW_PAYLOAD_TTL_DAYS;
  // guard: a negative/zero cutoff would purge recent or not-yet-resolved rows
  if (!Number.isFinite(olderThanDays) || olderThanDays < 1) {
    throw new Error(
      `pruneStaleRawPayloads: olderThanDays must be >= 1, got ${olderThanDays}`,
    );
  }
  const now = args.now ?? new Date();
  const cutoff = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000);
  const db = ctx?.db ?? defaultDb;

  return withBusyRetry(async () => {
    const updated = await db
      .update(externalServiceIncident)
      .set({
        rawPayload: null,
        rawPayloadPurgedAt: now,
      })
      .where(
        and(
          isNotNull(externalServiceIncident.rawPayload),
          isNotNull(externalServiceIncident.resolvedAt),
          lt(externalServiceIncident.resolvedAt, cutoff),
        ),
      )
      .returning({ id: externalServiceIncident.id })
      .all();
    return { purged: updated.length };
  });
}
