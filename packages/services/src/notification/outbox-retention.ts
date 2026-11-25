import { and, db as defaultDb, lt, sql } from "@openstatus/db";
import {
  monitorTransition,
  notificationOutbox,
  notificationTrigger,
} from "@openstatus/db/src/schema";

import type { DB, DrizzleClient } from "../context";

/** Deletes outbox rows and transition decisions created before their cutoffs (unix seconds), atomically. */
// oxlint-disable-next-line openstatus/services-mutation-guards -- retention of delivery bookkeeping with no actor; nothing a workspace configured is removed
export async function pruneNotificationOutbox(args: {
  outboxCutoff: number;
  decisionCutoff: number;
  db?: DrizzleClient;
}): Promise<{ outboxDeleted: number; decisionsDeleted: number }> {
  const db = args.db ?? defaultDb;
  const [outboxDeleted, decisionsDeleted] = await db.batch([
    // Pending rows older than the retention window are unreachable: the
    // delivery deadline is minutes, not weeks.
    db
      .delete(notificationOutbox)
      .where(lt(notificationOutbox.createdAt, args.outboxCutoff))
      .returning({ id: notificationOutbox.id }),
    db
      .delete(monitorTransition)
      .where(lt(monitorTransition.createdAt, args.decisionCutoff))
      .returning({ id: monitorTransition.id }),
  ]);
  return {
    outboxDeleted: outboxDeleted.length,
    decisionsDeleted: decisionsDeleted.length,
  };
}

export type OutboxShadowKey = {
  monitorId: number | null;
  notificationId: number | null;
  cronTimestamp: number;
};

/** Outbox rows since `since` (ms) without a matching notification_trigger. */
export async function listOutboxRowsWithoutTrigger(args: {
  since: number;
  db?: DB;
}): Promise<OutboxShadowKey[]> {
  return (args.db ?? defaultDb)
    .select({
      monitorId: notificationOutbox.monitorId,
      notificationId: notificationOutbox.notificationId,
      cronTimestamp: notificationOutbox.cronTimestamp,
    })
    .from(notificationOutbox)
    .where(
      and(
        sql`${notificationOutbox.cronTimestamp} >= ${args.since}`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${notificationTrigger}
          WHERE ${notificationTrigger.monitorId} = ${notificationOutbox.monitorId}
            AND ${notificationTrigger.notificationId} = ${notificationOutbox.notificationId}
            AND ${notificationTrigger.cronTimestamp} = ${notificationOutbox.cronTimestamp})`,
      ),
    )
    .all();
}

/** notification_trigger rows since `since` (ms) without a matching outbox row. */
export async function listTriggersWithoutOutboxRow(args: {
  since: number;
  db?: DB;
}): Promise<OutboxShadowKey[]> {
  return (args.db ?? defaultDb)
    .select({
      monitorId: notificationTrigger.monitorId,
      notificationId: notificationTrigger.notificationId,
      cronTimestamp: notificationTrigger.cronTimestamp,
    })
    .from(notificationTrigger)
    .where(
      and(
        sql`${notificationTrigger.cronTimestamp} >= ${args.since}`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${notificationOutbox}
          WHERE ${notificationOutbox.monitorId} = ${notificationTrigger.monitorId}
            AND ${notificationOutbox.notificationId} = ${notificationTrigger.notificationId}
            AND ${notificationOutbox.cronTimestamp} = ${notificationTrigger.cronTimestamp})`,
      ),
    )
    .all();
}
