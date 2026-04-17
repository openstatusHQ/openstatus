import type { NotificationContext } from "@openstatus/notification-base";
import { assertSafeUrl, transformHeaders } from "@openstatus/utils";
import { PayloadSchema, WebhookSchema } from "./schema";

export const sendAlert = async ({
  monitor,
  notification,
  cronTimestamp,
  statusCode,
  latency,
  message,
}: NotificationContext) => {
  const notificationData = WebhookSchema.parse(JSON.parse(notification.data));

  const body = PayloadSchema.parse({
    monitor: monitor,
    cronTimestamp,
    status: "error",
    statusCode,
    latency,
    errorMessage: message,
  });

  await assertSafeUrl(notificationData.webhook.endpoint);
  const res = await fetch(notificationData.webhook.endpoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(notificationData.webhook.headers ?? []),
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to send webhook notification: ${res.statusText}`);
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
  cronTimestamp,
  latency,
  statusCode,
  message,
}: NotificationContext) => {
  const notificationData = WebhookSchema.parse(JSON.parse(notification.data));

  const body = PayloadSchema.parse({
    monitor: monitor,
    cronTimestamp,
    status: "recovered",
    statusCode,
    latency,
    errorMessage: message,
  });
  const url = notificationData.webhook.endpoint;
  await assertSafeUrl(url);
  const res = await fetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(notificationData.webhook.headers ?? []),
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to send webhook notification: ${res.statusText}`);
  }
};

export const sendDegraded = async ({
  monitor,
  notification,
  cronTimestamp,
  latency,
  statusCode,
  message,
}: NotificationContext) => {
  const notificationData = WebhookSchema.parse(JSON.parse(notification.data));

  const body = PayloadSchema.parse({
    monitor: monitor,
    cronTimestamp,
    status: "degraded",
    statusCode,
    latency,
    errorMessage: message,
  });

  await assertSafeUrl(notificationData.webhook.endpoint);
  const res = await fetch(notificationData.webhook.endpoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(notificationData.webhook.headers ?? []),
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to send webhook notification: ${res.statusText}`);
  }
};

export const sendTest = async ({
  url,
  headers,
}: {
  url: string;
  headers?: { key: string; value: string }[];
}) => {
  const body = PayloadSchema.parse({
    monitor: {
      id: 1,
      name: "test",
      url: "http://openstat.us",
    },
    cronTimestamp: Date.now(),
    status: "recovered",
    statusCode: 200,
    latency: 1337,
  });
  await assertSafeUrl(url);
  try {
    const response = await fetch(url, {
      method: "post",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...transformHeaders(headers ?? []),
      },
    });
    if (!response.ok) {
      throw new Error("Failed to send test");
    }
    return true;
  } catch (err) {
    console.log(err);
    throw new Error("Failed to send test");
  }
};
