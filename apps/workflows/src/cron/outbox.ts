import { getLogger } from "@logtape/logtape";
import { and, db, lt, sql } from "@openstatus/db";
import {
  checkerDecision,
  checkerOutbox,
  notificationTrigger,
} from "@openstatus/db/src/schema";
import { withBusyRetry } from "@openstatus/services";
import * as Sentry from "@sentry/deno";

import { drainUntilEmpty, sweepExpiredOutbox } from "../checker/outbox";

const logger = getLogger(["workflow"]);

const OUTBOX_RETENTION_DAYS = 45;
const DECISION_RETENTION_DAYS = 90;
const SHADOW_WINDOW_MS = 15 * 60 * 1000;

export async function handleOutboxDrainCron() {
  const summary = await drainUntilEmpty();
  const expired = await sweepExpiredOutbox();
  if (
    summary.claimed > 0 ||
    expired.deadLettered > 0 ||
    expired.discarded > 0
  ) {
    logger.info("Outbox safety-net drain", { ...summary, ...expired });
  }
  return { ...summary, ...expired };
}

export async function handleOutboxRetentionCron() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const outboxCutoff = nowSeconds - OUTBOX_RETENTION_DAYS * 24 * 60 * 60;
  const decisionCutoff = nowSeconds - DECISION_RETENTION_DAYS * 24 * 60 * 60;

  const [outboxDeleted, decisionsDeleted] = await withBusyRetry(() =>
    db.batch([
      // Pending rows older than the retention window are unreachable: the
      // delivery deadline is minutes, not weeks.
      db
        .delete(checkerOutbox)
        .where(lt(checkerOutbox.createdAt, outboxCutoff))
        .returning({ id: checkerOutbox.id }),
      db
        .delete(checkerDecision)
        .where(lt(checkerDecision.createdAt, decisionCutoff))
        .returning({ id: checkerDecision.id }),
    ]),
  );

  logger.info("Outbox retention", {
    outbox_deleted: outboxDeleted.length,
    decisions_deleted: decisionsDeleted.length,
  });

  return {
    outboxDeleted: outboxDeleted.length,
    decisionsDeleted: decisionsDeleted.length,
  };
}

/**
 * Shadow gate: while the inline sender still delivers, every outbox row must
 * have a matching notification_trigger and vice versa. A mismatch means the SQL
 * quorum and the TypeScript quorum disagree on real data.
 */
export async function handleOutboxShadowCron() {
  const since = Date.now() - SHADOW_WINDOW_MS;

  const missingTrigger = await withBusyRetry(() =>
    db
      .select({
        monitorId: checkerOutbox.monitorId,
        notificationId: checkerOutbox.notificationId,
        cronTimestamp: checkerOutbox.cronTimestamp,
      })
      .from(checkerOutbox)
      .where(
        and(
          sql`${checkerOutbox.cronTimestamp} >= ${since}`,
          sql`NOT EXISTS (
            SELECT 1 FROM ${notificationTrigger}
            WHERE ${notificationTrigger.monitorId} = ${checkerOutbox.monitorId}
              AND ${notificationTrigger.notificationId} = ${checkerOutbox.notificationId}
              AND ${notificationTrigger.cronTimestamp} = ${checkerOutbox.cronTimestamp})`,
        ),
      )
      .all(),
  );

  const missingOutbox = await withBusyRetry(() =>
    db
      .select({
        monitorId: notificationTrigger.monitorId,
        notificationId: notificationTrigger.notificationId,
        cronTimestamp: notificationTrigger.cronTimestamp,
      })
      .from(notificationTrigger)
      .where(
        and(
          sql`${notificationTrigger.cronTimestamp} >= ${since}`,
          sql`NOT EXISTS (
            SELECT 1 FROM ${checkerOutbox}
            WHERE ${checkerOutbox.monitorId} = ${notificationTrigger.monitorId}
              AND ${checkerOutbox.notificationId} = ${notificationTrigger.notificationId}
              AND ${checkerOutbox.cronTimestamp} = ${notificationTrigger.cronTimestamp})`,
        ),
      )
      .all(),
  );

  const result = {
    missingTrigger: missingTrigger.length,
    missingOutbox: missingOutbox.length,
  };

  if (missingTrigger.length > 0 || missingOutbox.length > 0) {
    logger.error("Outbox shadow mismatch", {
      ...result,
      sample_missing_trigger: missingTrigger.slice(0, 5),
      sample_missing_outbox: missingOutbox.slice(0, 5),
    });
    Sentry.captureMessage(
      `Outbox shadow mismatch: ${missingTrigger.length} outbox rows without a trigger, ${missingOutbox.length} triggers without an outbox row`,
      "error",
    );
  }

  return result;
}
