import { and, db as defaultDb, eq, lt, sql } from "@openstatus/db";
import { alertDeadLetter, alertInbox } from "@openstatus/db/src/schema";
import type { z } from "zod";

import type { DB } from "../context";
import { PruneInboxInput } from "./schemas";

export type PruneResult = {
  processed: number;
  ignored: number;
  deadLettered: number;
};

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Retention is tiered by outcome: a processed row's value already lives in the
 * incident, an ignored row is the upgrade offer, and a dead letter is the
 * replay corpus. Raw third-party payloads never outlive their usefulness.
 */
export async function pruneAlertInbox(args: {
  input?: z.input<typeof PruneInboxInput>;
  db?: DB;
  now?: Date;
}): Promise<PruneResult> {
  const input = PruneInboxInput.parse(args.input ?? {});
  const tx = args.db ?? defaultDb;
  const now = Math.floor((args.now ?? new Date()).getTime() / 1000);

  const processed = await tx
    .delete(alertInbox)
    .where(
      and(
        eq(alertInbox.processingStatus, "settled"),
        eq(alertInbox.outcome, "processed"),
        lt(
          alertInbox.receivedAt,
          now - input.processedOlderThanDays * DAY_SECONDS,
        ),
      ),
    )
    .returning({ id: alertInbox.id });

  const ignored = await tx
    .delete(alertInbox)
    .where(
      and(
        eq(alertInbox.processingStatus, "settled"),
        sql`${alertInbox.outcome} IN ('ignored', 'invalid')`,
        lt(
          alertInbox.receivedAt,
          now - input.ignoredOlderThanDays * DAY_SECONDS,
        ),
      ),
    )
    .returning({ id: alertInbox.id });

  const deadLettered = await tx
    .delete(alertDeadLetter)
    .where(
      lt(
        alertDeadLetter.diedAt,
        now - input.deadLetterOlderThanDays * DAY_SECONDS,
      ),
    )
    .returning({ id: alertDeadLetter.id });

  return {
    processed: processed.length,
    ignored: ignored.length,
    deadLettered: deadLettered.length,
  };
}
