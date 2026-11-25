import { getLogger } from "@logtape/logtape";
import { withBusyRetry } from "@openstatus/services";
import {
  listOutboxRowsWithoutTrigger,
  listTriggersWithoutOutboxRow,
  pruneNotificationOutbox,
} from "@openstatus/services/notification";
import * as Sentry from "@sentry/node";

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

  const { outboxDeleted, decisionsDeleted } = await withBusyRetry(() =>
    pruneNotificationOutbox({ outboxCutoff, decisionCutoff }),
  );

  logger.info("Outbox retention", {
    outbox_deleted: outboxDeleted,
    decisions_deleted: decisionsDeleted,
  });

  return { outboxDeleted, decisionsDeleted };
}

/**
 * Shadow gate: while the inline sender still delivers, every outbox row must
 * have a matching notification_trigger and vice versa. A mismatch means the SQL
 * quorum and the TypeScript quorum disagree on real data.
 */
export async function handleOutboxShadowCron() {
  const since = Date.now() - SHADOW_WINDOW_MS;

  const missingTrigger = await withBusyRetry(() =>
    listOutboxRowsWithoutTrigger({ since }),
  );
  const missingOutbox = await withBusyRetry(() =>
    listTriggersWithoutOutboxRow({ since }),
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
