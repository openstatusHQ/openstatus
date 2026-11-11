import type { NotificationContext } from "@openstatus/notification-base";
import { raceWithSignal, safeFetch, transformHeaders } from "@openstatus/utils";

import { PayloadSchema, WebhookSchema } from "./schema";

export const WEBHOOK_TIMEOUT_MS = 5000;

export interface WebhookDeliveryOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

function resolveDeliverySignal(options?: WebhookDeliveryOptions): {
  signal: AbortSignal;
} {
  const timeoutMs = options?.timeoutMs ?? WEBHOOK_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (options?.signal) {
    return {
      signal: AbortSignal.any([options.signal, timeoutSignal]),
    };
  }
  return { signal: timeoutSignal };
}

export const sendAlert = async (
  context: NotificationContext & WebhookDeliveryOptions,
  options?: WebhookDeliveryOptions,
) => {
  const { signal } = resolveDeliverySignal({
    signal: options?.signal ?? context.signal,
    timeoutMs: options?.timeoutMs ?? context.timeoutMs,
  });

  const notificationData = WebhookSchema.parse(
    JSON.parse(context.notification.data),
  );

  const body = PayloadSchema.parse({
    monitor: context.monitor,
    cronTimestamp: context.cronTimestamp,
    status: "error",
    statusCode: context.statusCode,
    latency: context.latency,
    errorMessage: context.message,
  });

  const res = await safeFetch(notificationData.webhook.endpoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(notificationData.webhook.headers ?? []),
    },
    signal,
  });
  try {
    if (!res.ok) {
      throw new Error(`Failed to send webhook notification: ${res.statusText}`);
    }
  } finally {
    if (res.body) {
      await raceWithSignal(res.body.cancel(), signal);
    }
  }
};

export const sendRecovery = async (
  context: NotificationContext & WebhookDeliveryOptions,
  options?: WebhookDeliveryOptions,
) => {
  const { signal } = resolveDeliverySignal({
    signal: options?.signal ?? context.signal,
    timeoutMs: options?.timeoutMs ?? context.timeoutMs,
  });

  const notificationData = WebhookSchema.parse(
    JSON.parse(context.notification.data),
  );

  const body = PayloadSchema.parse({
    monitor: context.monitor,
    cronTimestamp: context.cronTimestamp,
    status: "recovered",
    statusCode: context.statusCode,
    latency: context.latency,
    errorMessage: context.message,
  });

  const url = notificationData.webhook.endpoint;
  const res = await safeFetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(notificationData.webhook.headers ?? []),
    },
    signal,
  });
  try {
    if (!res.ok) {
      throw new Error(`Failed to send webhook notification: ${res.statusText}`);
    }
  } finally {
    if (res.body) {
      await raceWithSignal(res.body.cancel(), signal);
    }
  }
};

export const sendDegraded = async (
  context: NotificationContext & WebhookDeliveryOptions,
  options?: WebhookDeliveryOptions,
) => {
  const { signal } = resolveDeliverySignal({
    signal: options?.signal ?? context.signal,
    timeoutMs: options?.timeoutMs ?? context.timeoutMs,
  });

  const notificationData = WebhookSchema.parse(
    JSON.parse(context.notification.data),
  );

  const body = PayloadSchema.parse({
    monitor: context.monitor,
    cronTimestamp: context.cronTimestamp,
    status: "degraded",
    statusCode: context.statusCode,
    latency: context.latency,
    errorMessage: context.message,
  });

  const res = await safeFetch(notificationData.webhook.endpoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(notificationData.webhook.headers ?? []),
    },
    signal,
  });
  try {
    if (!res.ok) {
      throw new Error(`Failed to send webhook notification: ${res.statusText}`);
    }
  } finally {
    if (res.body) {
      await raceWithSignal(res.body.cancel(), signal);
    }
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
  const { signal: deliverySignal } = resolveDeliverySignal({
    signal,
    timeoutMs,
  });

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
    const response = await safeFetch(url, {
      method: "post",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...transformHeaders(headers ?? []),
      },
      signal: deliverySignal,
    });
    try {
      if (!response.ok) {
        throw new Error("Failed to send test");
      }
      return true;
    } finally {
      if (response.body) {
        await raceWithSignal(response.body.cancel(), deliverySignal);
      }
    }
  } catch (err) {
    console.log(err);
    throw new Error("Failed to send test");
  }
};
