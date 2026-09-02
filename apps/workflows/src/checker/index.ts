import { getLogger } from "@logtape/logtape";
import { monitorRegions } from "@openstatus/db/src/schema/constants";
import { monitorStatusSchema } from "@openstatus/db/src/schema/monitors/validation";
import { Hono } from "hono";
import { z } from "zod";

import { env } from "../env";
import type { Env } from "../index";
import { checkerAudit } from "../utils/audit-log";
import { triggerNotifications } from "./alerting";
import { enqueueOutbox } from "./outbox";
import { updateStatusPrivate } from "./private-location";
import { EVENT_TYPE, applyStatusTransition, isStaleCheck } from "./transition";

export const checkerRoute = new Hono<Env>();

checkerRoute.post("/updateStatusPrivate", updateStatusPrivate);

const payloadSchema = z.object({
  monitorId: z.string(),
  message: z.string().optional(),
  statusCode: z.number().optional(),
  region: z.enum(monitorRegions),
  cronTimestamp: z.number(),
  status: monitorStatusSchema,
  latency: z.number().optional(),
});

type Payload = z.infer<typeof payloadSchema>;

const logger = getLogger(["workflow"]);

async function publishStatusAudit(payload: Payload): Promise<void> {
  const { monitorId, region, statusCode, cronTimestamp, latency } = payload;
  const id = `monitor:${monitorId}`;
  const targets = [{ id: monitorId, type: "monitor" as const }];
  const metadata = {
    region,
    statusCode: statusCode ?? -1,
    cronTimestamp,
    latency,
  };

  switch (payload.status) {
    case "active":
      await checkerAudit.publishAuditLog({
        id,
        action: "monitor.recovered",
        targets,
        metadata,
      });
      break;
    case "degraded":
      await checkerAudit.publishAuditLog({
        id,
        action: "monitor.degraded",
        targets,
        metadata,
      });
      break;
    case "error":
      await checkerAudit.publishAuditLog({
        id,
        action: "monitor.failed",
        targets,
        metadata: { ...metadata, message: payload.message },
      });
      break;
  }
}

checkerRoute.post("/updateStatus", async (c) => {
  const config = env();
  const auth = c.req.header("Authorization");
  if (auth !== `Basic ${config.CRON_SECRET}`) {
    logger.error("Unauthorized");
    return c.text("Unauthorized", 401);
  }

  const event = c.get("event");
  const result = payloadSchema.safeParse(await c.req.json());

  if (!result.success) {
    return c.text("Unprocessable Entity", 422);
  }

  const {
    monitorId,
    message,
    region,
    statusCode,
    cronTimestamp,
    status,
    latency,
  } = result.data;
  const monitorIdNumber = Number(monitorId);

  logger.info("Updating monitor status", {
    monitor_id: monitorId,
    region,
    status,
    status_code: statusCode,
    cron_timestamp: cronTimestamp,
    latency_ms: latency,
  });

  const statusUpdate: Record<string, unknown> = {
    status,
    message,
    region,
    status_code: statusCode,
    cron_timestamp: cronTimestamp,
    latency_ms: latency,
    monitorId: monitorIdNumber,
  };
  event.status_update = statusUpdate;

  if (isStaleCheck(cronTimestamp, config.STALE_CHECK_MS)) {
    statusUpdate.stale = true;
    return c.json({ success: true }, 200);
  }

  const transition = await applyStatusTransition({
    monitorId: monitorIdNumber,
    region,
    status,
    cronTimestamp,
    statusCode,
    message,
    latency,
    deadlineSeconds: Math.floor(config.OUTBOX_DEADLINE_MS / 1000),
    rolloutPct: config.OUTBOX_ROLLOUT_PCT,
  });

  if (transition.kind === "unchanged") {
    statusUpdate.fast_path_skipped = true;
    return c.json({ success: true }, 200);
  }

  if (transition.kind === "monitor-missing") {
    statusUpdate.monitor_missing = true;
    return c.json({ success: true }, 200);
  }

  statusUpdate.affectedRegionsCount = transition.affectedRegions.length;
  statusUpdate.quorum_count = transition.quorumCount;
  statusUpdate.region_count = transition.regionCount;
  statusUpdate.transition_applied = transition.transitioned;
  statusUpdate.outbox_rows = transition.outboxRows.length;

  await publishStatusAudit(result.data);

  if (!transition.transitioned) {
    return c.text("Ok", 200);
  }

  logger.info("Monitor status changed", {
    monitor_id: monitorIdNumber,
    status,
  });

  let triggeredNotifications: { notificationId: number; provider: string }[] =
    [];

  // Ownership is whatever the batch actually wrote, not a second copy of the
  // rollout formula: `pending` means the drainer owns it, `done` means the
  // inline sender does.
  if (transition.outboxRows.some((row) => row.deliveryStatus === "pending")) {
    enqueueOutbox(transition.outboxRows.map((row) => row.id));
    triggeredNotifications = transition.outboxRows.map((row) => ({
      notificationId: row.notificationId,
      provider: row.provider,
    }));
  } else if (transition.outboxRows.length > 0) {
    triggeredNotifications = await triggerNotifications({
      monitorId,
      statusCode,
      message,
      notifType: EVENT_TYPE[status],
      cronTimestamp,
      regions: transition.affectedRegions,
      latency,
      incidentId: transition.incidentId ?? undefined,
    });
  }

  statusUpdate.notificationTriggered = triggeredNotifications.length > 0;
  statusUpdate.notifications = triggeredNotifications;

  return c.text("Ok", 200);
});
