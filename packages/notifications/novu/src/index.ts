import type {
  NotificationContext,
  NotificationType,
} from "@openstatus/notification-base";

import { NovuSchema } from "./schema";

type NovuConfig = {
  apiKey: string;
  workflowId: string;
  subscriberId: string;
  region: "us" | "eu";
};

// Novu's cloud API is region-split; "eu" data stays on eu.api.novu.co.
function triggerUrl(region: "us" | "eu") {
  return region === "eu"
    ? "https://eu.api.novu.co/v1/events/trigger"
    : "https://api.novu.co/v1/events/trigger";
}

const statusForType: Record<NotificationType, string> = {
  alert: "down",
  degraded: "degraded",
  recovery: "recovered",
};

async function triggerWorkflow(
  config: NovuConfig,
  type: NotificationType,
  ctx: NotificationContext,
) {
  const { monitor, statusCode, message, cronTimestamp, regions, latency } = ctx;
  const res = await fetch(triggerUrl(config.region), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${config.apiKey}`,
      // Novu dedupes retried triggers for the same monitor state transition.
      "Idempotency-Key": `${monitor.id}-${cronTimestamp}-${type}`,
    },
    body: JSON.stringify({
      name: config.workflowId,
      to: { subscriberId: config.subscriberId },
      payload: {
        type,
        status: statusForType[type],
        monitorId: `${monitor.id}`,
        monitorName: monitor.name,
        monitorUrl: monitor.url,
        statusCode,
        message,
        regions,
        latency,
        cronTimestamp,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to trigger Novu ${type}: ${res.status} ${res.statusText}`,
    );
  }
}

export const sendAlert = async (ctx: NotificationContext) => {
  const { novu } = NovuSchema.parse(JSON.parse(ctx.notification.data));
  await triggerWorkflow(novu, "alert", ctx);
};

export const sendDegraded = async (ctx: NotificationContext) => {
  const { novu } = NovuSchema.parse(JSON.parse(ctx.notification.data));
  await triggerWorkflow(novu, "degraded", ctx);
};

export const sendRecovery = async (ctx: NotificationContext) => {
  const { novu } = NovuSchema.parse(JSON.parse(ctx.notification.data));
  await triggerWorkflow(novu, "recovery", ctx);
};

export const sendTest = async (props: {
  apiKey: string;
  workflowId: string;
  subscriberId: string;
  region: "us" | "eu";
}) => {
  try {
    const res = await fetch(triggerUrl(props.region), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${props.apiKey}`,
      },
      body: JSON.stringify({
        name: props.workflowId,
        to: { subscriberId: props.subscriberId },
        payload: {
          type: "test",
          status: "test",
          message:
            "If you can read this, your Novu integration is working correctly.",
        },
      }),
    });
    return res.ok;
  } catch (err) {
    console.log(err);
    return false;
  }
};

export { NovuSchema };
