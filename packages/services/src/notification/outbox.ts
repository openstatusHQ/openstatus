import {
  and,
  db as defaultDb,
  eq,
  inArray,
  lt,
  notInArray,
  sql,
} from "@openstatus/db";
import {
  monitor,
  monitorIncidentTable,
  notification,
  notificationDeadLetter,
  notificationOutbox,
  notificationTrigger,
} from "@openstatus/db/src/schema";

import { withBusyRetry } from "../retry";

// Outbox rows are delivery bookkeeping written by the drainer, with no actor:
// the writes below carry no scope check or audit row.

export type OutboxRow = typeof notificationOutbox.$inferSelect;

const MAX_ERROR_LENGTH = 2000;

/**
 * Claims only the oldest pending row per (monitor, notification), so an alert
 * and the recovery behind it can never be delivered out of order, including
 * across machines. Only monitors with `id % 100 < rolloutPct` are claimable.
 */
// oxlint-disable-next-line openstatus/services-mutation-guards -- outbox lease taken by the drainer, no actor to scope or audit
export async function claimOutboxRows(args: {
  workerId: string;
  limit: number;
  rolloutPct: number;
  leaseSeconds: number;
  monitorIds?: number[];
}): Promise<OutboxRow[]> {
  const { workerId, limit, rolloutPct, leaseSeconds, monitorIds } = args;
  const scope =
    monitorIds === undefined
      ? sql``
      : sql` AND o.monitor_id IN (${sql.join(
          monitorIds.map((id) => sql`${id}`),
          sql`, `,
        )})`;

  return withBusyRetry(() =>
    defaultDb
      .update(notificationOutbox)
      .set({
        lockedBy: workerId,
        lockedUntil: sql`min(unixepoch() + ${leaseSeconds}, ${notificationOutbox.deadlineAt})`,
        attempts: sql`${notificationOutbox.attempts} + 1`,
      })
      .where(
        sql`${notificationOutbox.id} IN (
          SELECT o.id FROM ${notificationOutbox} o
          WHERE o.delivery_status = 'pending'
            AND (o.monitor_id % 100) < ${rolloutPct}
            AND o.next_attempt_at <= unixepoch()
            AND o.deadline_at > unixepoch()${scope}
            AND (o.locked_until IS NULL OR o.locked_until < unixepoch())
            AND NOT EXISTS (
              SELECT 1 FROM ${notificationOutbox} older
              WHERE older.monitor_id = o.monitor_id
                AND older.notification_id = o.notification_id
                AND older.delivery_status = 'pending'
                AND older.id < o.id)
          ORDER BY o.id LIMIT ${limit})`,
      )
      .returning(),
  );
}

/** Monitor, notification and incident rows behind claimed outbox rows, in one batch. */
export async function loadOutboxDeliveryRows(args: {
  monitorIds: number[];
  notificationIds: number[];
  incidentIds: number[];
}) {
  const { monitorIds, notificationIds, incidentIds } = args;
  const [monitors, notifications, incidents] = await withBusyRetry(() =>
    defaultDb.batch([
      defaultDb.select().from(monitor).where(inArray(monitor.id, monitorIds)),
      defaultDb
        .select()
        .from(notification)
        .where(inArray(notification.id, notificationIds)),
      defaultDb
        .select()
        .from(monitorIncidentTable)
        .where(
          incidentIds.length === 0
            ? sql`1 = 0`
            : inArray(monitorIncidentTable.id, incidentIds),
        ),
    ]),
  );
  return { monitors, notifications, incidents };
}

/** Settles delivered rows and writes their triggers in one atomic batch. */
// oxlint-disable-next-line openstatus/services-mutation-guards -- delivery bookkeeping with no actor; the notification itself is the record
export async function settleDeliveredOutboxRows(
  rows: Pick<
    OutboxRow,
    "id" | "monitorId" | "notificationId" | "cronTimestamp"
  >[],
): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((row) => row.id);

  await withBusyRetry(() =>
    defaultDb.batch([
      defaultDb
        .update(notificationOutbox)
        .set({
          deliveryStatus: "settled",
          outcome: "delivered",
          deliveredAt: Math.floor(Date.now() / 1000),
          lockedBy: null,
          lockedUntil: null,
        })
        .where(inArray(notificationOutbox.id, ids)),
      defaultDb
        .insert(notificationTrigger)
        .values(
          rows.map((row) => ({
            monitorId: row.monitorId,
            notificationId: row.notificationId,
            cronTimestamp: row.cronTimestamp,
          })),
        )
        .onConflictDoNothing(),
    ]),
  );
}

// oxlint-disable-next-line openstatus/services-mutation-guards -- delivery bookkeeping with no actor; the reason is kept on the row
export async function settleSkippedOutboxRows(
  entries: { id: number; reason: string }[],
): Promise<void> {
  const [first, ...rest] = entries.map((entry) =>
    defaultDb
      .update(notificationOutbox)
      .set({
        deliveryStatus: "settled",
        outcome: "skipped",
        lockedBy: null,
        lockedUntil: null,
        lastError: entry.reason,
      })
      .where(eq(notificationOutbox.id, entry.id)),
  );
  if (first === undefined) return;
  await withBusyRetry(() => defaultDb.batch([first, ...rest]));
}

/**
 * Hands rows back with their backoff recorded. `attempts` already counts this
 * claim, so the row carries how many sends it has cost across every worker.
 */
// oxlint-disable-next-line openstatus/services-mutation-guards -- delivery bookkeeping with no actor; the error is kept on the row
export async function rescheduleOutboxRows(
  entries: { id: number; error: string; nextAttemptAt: number }[],
): Promise<void> {
  const [first, ...rest] = entries.map((entry) =>
    defaultDb
      .update(notificationOutbox)
      .set({
        nextAttemptAt: entry.nextAttemptAt,
        lockedBy: null,
        lockedUntil: null,
        lastError: entry.error.slice(0, MAX_ERROR_LENGTH),
      })
      .where(eq(notificationOutbox.id, entry.id)),
  );
  if (first === undefined) return;
  await withBusyRetry(() => defaultDb.batch([first, ...rest]));
}

// oxlint-disable-next-line openstatus/services-mutation-guards -- releases the drainer's own lease, no actor to scope or audit
export async function releaseOutboxRows(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await withBusyRetry(() =>
    defaultDb
      .update(notificationOutbox)
      .set({ lockedBy: null, lockedUntil: null })
      .where(inArray(notificationOutbox.id, ids)),
  );
}

/** Every lease `workerId` holds, except rows whose send is still in flight. */
// oxlint-disable-next-line openstatus/services-mutation-guards -- releases the drainer's own leases on shutdown, no actor to scope or audit
export async function releaseWorkerOutboxClaims(args: {
  workerId: string;
  exceptIds: number[];
}): Promise<void> {
  const { workerId, exceptIds } = args;
  await withBusyRetry(() =>
    defaultDb
      .update(notificationOutbox)
      .set({ lockedBy: null, lockedUntil: null })
      .where(
        exceptIds.length === 0
          ? eq(notificationOutbox.lockedBy, workerId)
          : and(
              eq(notificationOutbox.lockedBy, workerId),
              notInArray(notificationOutbox.id, exceptIds),
            ),
      ),
  );
}

/** Moves rows to the dead-letter table, insert and delete in one atomic batch. */
// oxlint-disable-next-line openstatus/services-mutation-guards -- delivery bookkeeping with no actor; the dead letter is the record
export async function deadLetterOutboxRows(
  entries: { row: OutboxRow; error: string }[],
): Promise<void> {
  if (entries.length === 0) return;
  const diedAt = Math.floor(Date.now() / 1000);

  await withBusyRetry(() =>
    defaultDb.batch([
      defaultDb.insert(notificationDeadLetter).values(
        entries.map(({ row, error }) => ({
          outboxId: row.id,
          dedupKey: row.dedupKey,
          monitorId: row.monitorId,
          workspaceId: row.workspaceId,
          notificationId: row.notificationId,
          provider: row.provider,
          eventType: row.eventType,
          fromStatus: row.fromStatus,
          toStatus: row.toStatus,
          cronTimestamp: row.cronTimestamp,
          incidentId: row.incidentId,
          payload: row.payload,
          attempts: row.attempts,
          finalError: error.slice(0, MAX_ERROR_LENGTH),
          diedAt,
        })),
      ),
      defaultDb.delete(notificationOutbox).where(
        inArray(
          notificationOutbox.id,
          entries.map(({ row }) => row.id),
        ),
      ),
    ]),
  );
}

/** Pending rows whose deadline passed before `before` (unix seconds). */
export async function listExpiredOutboxRows(args: {
  before: number;
  limit: number;
}): Promise<OutboxRow[]> {
  return withBusyRetry(() =>
    defaultDb
      .select()
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.deliveryStatus, "pending"),
          lt(notificationOutbox.deadlineAt, args.before),
        ),
      )
      .limit(args.limit)
      .all(),
  );
}

// oxlint-disable-next-line openstatus/services-mutation-guards -- drops rows the drainer never owned, no actor to scope or audit
export async function discardOutboxRows(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await withBusyRetry(() =>
    defaultDb
      .delete(notificationOutbox)
      .where(inArray(notificationOutbox.id, ids)),
  );
}
