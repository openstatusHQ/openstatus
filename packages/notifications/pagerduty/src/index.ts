import type { Monitor, Notification } from "@openstatus/db/src/schema";

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
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
}) => {
  const notificationData = PagerDutySchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const event = triggerEventPayloadSchema.parse({
    rounting_key: notificationData.integration_keys[0].integration_key,
    dedup_key: `${monitor.id}}-${incidentId}`,
    event_action: "trigger",
    payload: {
      summary: `${name} is down`,
      source: "Open Status",
      severity: "error",
      timestamp: new Date().toISOString(),
      custom_details: {
        statusCode,
        message,
      },
    },
  });

  try {
    for await (const integrationKey of notificationData.integration_keys) {
      // biome-ignore lint/correctness/noUnusedVariables: <explanation>
      const { integration_key, type } = integrationKey;

      await fetch("https://events.pagerduty.com/v2/enqueue", {
        method: "POST",
        body: JSON.stringify(event),
      });
    }
  } catch (err) {
    console.log(err);
    // Do something
  }
};

export const sendDegraded = async ({
  monitor,
  notification,
  statusCode,
  message,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
}) => {
  const notificationData = PagerDutySchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const event = triggerEventPayloadSchema.parse({
    rounting_key: notificationData.integration_keys[0].integration_key,
    dedup_key: `${monitor.id}}`,
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

  try {
    for await (const integrationKey of notificationData.integration_keys) {
      // biome-ignore lint/correctness/noUnusedVariables: <explanation>
      const { integration_key, type } = integrationKey;

      await fetch("https://events.pagerduty.com/v2/enqueue", {
        method: "POST",
        body: JSON.stringify(event),
      });
    }
  } catch (err) {
    console.log(err);
    // Do something
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  statusCode,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  message,
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
}) => {
  const notificationData = PagerDutySchema.parse(JSON.parse(notification.data));

  try {
    for await (const integrationKey of notificationData.integration_keys) {
      const event = resolveEventPayloadSchema.parse({
        rounting_key: integrationKey.integration_key,
        dedup_key: `${monitor.id}}-${incidentId}`,
        event_action: "resolve",
      });
      await fetch("https://events.pagerduty.com/v2/enqueue", {
        method: "POST",
        body: JSON.stringify(event),
      });
    }
  } catch (err) {
    console.log(err);
    // Do something
  }
};

export { PagerDutySchema };
