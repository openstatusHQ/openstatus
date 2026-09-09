import { and, db as defaultDb, eq, lt, sql } from "@openstatus/db";
import { alertDeadLetter, alertInbox } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { withBusyRetry } from "../retry";
import type { AlertInbox } from "../types";

export type ClaimInboxArgs = {
  workerId: string;
  limit: number;
  leaseSeconds: number;
  /** Narrows the claim to specific sources. Tests use it to stay deterministic. */
  alertSourceIds?: number[];
  db?: DB;
};

/**
 * Claims only the oldest pending row per (source, fingerprint), so a `resolved`
 * webhook can never be processed before the `firing` it closes. Rows with no
 * fingerprint skip the ordering constraint — they are already headed for the
 * dead letter.
 */
export async function claimInboxRows(
  args: ClaimInboxArgs,
): Promise<AlertInbox[]> {
  const { workerId, limit, leaseSeconds } = args;
  const tx = args.db ?? defaultDb;
  const scope =
    args.alertSourceIds === undefined
      ? sql``
      : sql` AND i.alert_source_id IN (${sql.join(
          args.alertSourceIds.map((id) => sql`${id}`),
          sql`, `,
        )})`;

  const predicate = sql`${alertInbox.id} IN (
    SELECT i.id FROM ${alertInbox} i
    WHERE i.processing_status = 'pending'
      AND i.next_attempt_at <= unixepoch()
      AND i.deadline_at > unixepoch()
      AND (i.locked_until IS NULL OR i.locked_until < unixepoch())${scope}
      AND (i.fingerprint IS NULL OR NOT EXISTS (
        SELECT 1 FROM ${alertInbox} older
        WHERE older.alert_source_id = i.alert_source_id
          AND older.fingerprint = i.fingerprint
          AND older.processing_status = 'pending'
          AND older.id < i.id))
    ORDER BY i.id LIMIT ${limit})`;

  // Claimed rows are read back by worker id rather than through RETURNING:
  // libSQL does not hand back rows for this update shape, and a silent empty
  // result would look like "nothing to do" while the lease was already taken.
  await withBusyRetry(() =>
    tx
      .update(alertInbox)
      .set({
        lockedBy: workerId,
        lockedUntil: sql`min(unixepoch() + ${leaseSeconds}, ${alertInbox.deadlineAt})`,
        attempts: sql`${alertInbox.attempts} + 1`,
      })
      .where(predicate),
  );

  return withBusyRetry(() =>
    tx
      .select()
      .from(alertInbox)
      .where(
        and(
          eq(alertInbox.lockedBy, workerId),
          eq(alertInbox.processingStatus, "pending"),
          sql`${alertInbox.lockedUntil} > unixepoch()`,
        ),
      )
      .orderBy(alertInbox.id)
      .all(),
  );
}

export async function settleInboxRow(args: {
  id: number;
  outcome: "processed" | "ignored" | "invalid";
  incidentId?: number | null;
  error?: string | null;
  db?: DB;
}): Promise<void> {
  const tx = args.db ?? defaultDb;
  await withBusyRetry(() =>
    tx
      .update(alertInbox)
      .set({
        processingStatus: "settled",
        outcome: args.outcome,
        incidentId: args.incidentId ?? null,
        lastError: args.error ?? null,
        processedAt: Math.floor(Date.now() / 1000),
        lockedBy: null,
        lockedUntil: null,
      })
      .where(eq(alertInbox.id, args.id)),
  );
}

export async function retryInboxRow(args: {
  id: number;
  nextAttemptAt: number;
  error: string;
  db?: DB;
}): Promise<void> {
  const tx = args.db ?? defaultDb;
  await withBusyRetry(() =>
    tx
      .update(alertInbox)
      .set({
        nextAttemptAt: args.nextAttemptAt,
        lastError: args.error,
        lockedBy: null,
        lockedUntil: null,
      })
      .where(eq(alertInbox.id, args.id)),
  );
}

/** Moves rather than flags, so the claim query keeps scanning a small table. */
export async function deadLetterInboxRow(args: {
  row: AlertInbox;
  error: string;
  db?: DB;
}): Promise<void> {
  const tx = args.db ?? defaultDb;
  const { row } = args;
  await withBusyRetry(async () => {
    await tx
      .insert(alertDeadLetter)
      .values({
        inboxId: row.id,
        alertSourceId: row.alertSourceId,
        dedupKey: row.dedupKey,
        rawBody: row.rawBody,
        contentType: row.contentType,
        externalId: row.externalId,
        fingerprint: row.fingerprint,
        attempts: row.attempts,
        finalError: args.error,
        receivedAt: row.receivedAt,
        diedAt: Math.floor(Date.now() / 1000),
      })
      .onConflictDoNothing();
    await tx.delete(alertInbox).where(eq(alertInbox.id, row.id));
  });
}

/** SIGTERM path: hand claimed-but-unstarted rows straight back. */
export async function releaseInboxClaims(args: {
  workerId: string;
  exceptIds?: number[];
  db?: DB;
}): Promise<number> {
  const tx = args.db ?? defaultDb;
  const except = args.exceptIds ?? [];
  const rows = await tx
    .update(alertInbox)
    .set({ lockedBy: null, lockedUntil: 0 })
    .where(
      and(
        eq(alertInbox.lockedBy, args.workerId),
        eq(alertInbox.processingStatus, "pending"),
        except.length > 0
          ? sql`${alertInbox.id} NOT IN (${sql.join(
              except.map((id) => sql`${id}`),
              sql`, `,
            )})`
          : sql`1 = 1`,
      ),
    )
    .returning({ id: alertInbox.id });
  return rows.length;
}

export async function expireInboxRows(args: {
  db?: DB;
}): Promise<AlertInbox[]> {
  const tx = args.db ?? defaultDb;
  return tx
    .select()
    .from(alertInbox)
    .where(
      and(
        eq(alertInbox.processingStatus, "pending"),
        lt(alertInbox.deadlineAt, sql`unixepoch()`),
      ),
    )
    .all();
}
