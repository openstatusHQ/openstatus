import { pagerdutyDataSchema } from "@openstatus/db/src/schema";
import type { NotificationContext } from "@openstatus/notification-base";
import {
  PagerDutySchema,
  resolveEventPayloadSchema,
  triggerEventPayloadSchema,
} from "./schema/config";

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
  cronTimestamp,
}: NotificationContext) => {
  const data = pagerdutyDataSchema.parse(JSON.parse(notification.data));

  const notificationData = PagerDutySchema.parse(JSON.parse(data.pagerduty));

  const { name } = monitor;

  for (const integrationKey of notificationData.integration_keys) {
    const { integration_key } = integrationKey;
    const event = triggerEventPayloadSchema.parse({
      routing_key: integration_key,
      dedup_key: `${monitor.id}-${incident?.id}`,
      event_action: "trigger",
      payload: {
        summary: `${name} is down`,
        source: "Open Status",
        severity: "error",
        timestamp: new Date(cronTimestamp).toISOString(),
        custom_details: {
          statusCode,
          message,
        },
      },
    });
    const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      console.log(`Failed to send alert notification: ${res.statusText}`);
      throw new Error("Failed to send alert notification");
    }
  }
};

export const sendDegraded = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
}: NotificationContext) => {
  const data = pagerdutyDataSchema.parse(JSON.parse(notification.data));

  const notificationData = PagerDutySchema.parse(JSON.parse(data.pagerduty));
  const { name } = monitor;

  for (const integrationKey of notificationData.integration_keys) {
    const { integration_key } = integrationKey;

    const event = triggerEventPayloadSchema.parse({
      routing_key: integration_key,
      dedup_key: `${monitor.id}-${incident?.id}`,
      event_action: "trigger",
      payload: {
        summary: `${name} is degraded`,
        source: "Open Status",
        severity: "warning",
        timestamp: new Date().toISOString(),
        custom_details: {
          statusCode,
          message,
        },
      },
    });

    const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      console.log(`Failed to send alert notification: ${res.statusText}`);
      throw new Error("Failed to send alert notification");
    }
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
  incident,
}: NotificationContext) => {
  const data = pagerdutyDataSchema.parse(JSON.parse(notification.data));

  const notificationData = PagerDutySchema.parse(JSON.parse(data.pagerduty));

  for (const integrationKey of notificationData.integration_keys) {
    const event = resolveEventPayloadSchema.parse({
      routing_key: integrationKey.integration_key,
      dedup_key: `${monitor.id}-${incident?.id}`,
      event_action: "resolve",
    });
    const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      console.log(`Failed to send alert notification: ${res.statusText}`);
      throw new Error("Failed to send alert notification");
    }
  }
};

export const sendTest = async ({
  integrationKey,
}: {
  integrationKey: string;
}) => {
  console.log("Sending test alert to PagerDuty");
  try {
    const event = triggerEventPayloadSchema.parse({
      routing_key: integrationKey,
      dedup_key: "openstatus-test",
      event_action: "trigger",
      payload: {
        summary: "This is a test from OpenStatus",
        source: "Open Status",
        severity: "error",
        timestamp: new Date().toISOString(),
        custom_details: {
          statusCode: 418,
          message: 'I"m a teapot',
        },
      },
    });

    const _res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
};
export { PagerDutySchema };
