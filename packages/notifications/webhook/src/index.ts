import type { NotificationContext } from "@openstatus/notification-base";
import { safeFetch, transformHeaders } from "@openstatus/utils";

import { PayloadSchema, WebhookSchema } from "./schema";

export const DEFAULT_WEBHOOK_TIMEOUT_MS = 10_000;

export interface WebhookDeliveryOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export function createDeliverySignal(
  options?: WebhookDeliveryOptions,
): AbortSignal {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return options?.signal
    ? AbortSignal.any([timeoutSignal, options.signal])
    : timeoutSignal;
}

async function deliverWebhook(
  url: string,
  body: unknown,
  headers?: { key: string; value: string }[],
  options?: WebhookDeliveryOptions,
): Promise<Response> {
  const signal = createDeliverySignal(options);

  return safeFetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(headers ?? []),
    },
    signal,
  });
}

export const sendAlert = async (
  {
    monitor,
    notification,
    cronTimestamp,
    statusCode,
    latency,
    message,
  }: NotificationContext,
  options?: WebhookDeliveryOptions,
) => {
  const notificationData = WebhookSchema.parse(JSON.parse(notification.data));

  const body = PayloadSchema.parse({
    monitor: monitor,
    cronTimestamp,
    status: "error",
    statusCode,
    latency,
    errorMessage: message,
  });

  const res = await deliverWebhook(
    notificationData.webhook.endpoint,
    body,
    notificationData.webhook.headers,
    options,
  );
  try {
    if (!res.ok) {
      throw new Error(`Failed to send webhook notification: ${res.statusText}`);
    }
  } finally {
    await res.body?.cancel();
  }
};

export const sendRecovery = async (
  {
    monitor,
    notification,
    cronTimestamp,
    latency,
    statusCode,
    message,
  }: NotificationContext,
  options?: WebhookDeliveryOptions,
) => {
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
  const res = await deliverWebhook(
    url,
    body,
    notificationData.webhook.headers,
    options,
  );
  try {
    if (!res.ok) {
      throw new Error(`Failed to send webhook notification: ${res.statusText}`);
    }
  } finally {
    await res.body?.cancel();
  }
};

export const sendDegraded = async (
  {
    monitor,
    notification,
    cronTimestamp,
    latency,
    statusCode,
    message,
  }: NotificationContext,
  options?: WebhookDeliveryOptions,
) => {
  const notificationData = WebhookSchema.parse(JSON.parse(notification.data));

  const body = PayloadSchema.parse({
    monitor: monitor,
    cronTimestamp,
    status: "degraded",
    statusCode,
    latency,
    errorMessage: message,
  });

  const res = await deliverWebhook(
    notificationData.webhook.endpoint,
    body,
    notificationData.webhook.headers,
    options,
  );
  try {
    if (!res.ok) {
      throw new Error(`Failed to send webhook notification: ${res.statusText}`);
    }
  } finally {
    await res.body?.cancel();
  }
};

export const sendTest = async ({
  url,
  headers,
  timeoutMs,
  signal,
}: {
  url: string;
  headers?: { key: string; value: string }[];
  timeoutMs?: number;
  signal?: AbortSignal;
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
  try {
    const response = await deliverWebhook(url, body, headers, {
      timeoutMs,
      signal,
    });
    try {
      if (!response.ok) {
        throw new Error("Failed to send test");
      }
      return true;
    } finally {
      await response.body?.cancel();
    }
  } catch (err) {
    console.log(err);
    throw new Error("Failed to send test", { cause: err });
  }
};
