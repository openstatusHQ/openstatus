import type { NotificationContext } from "@openstatus/notification-base";
import { safeFetch, transformHeaders } from "@openstatus/utils";

import { PayloadSchema, WebhookSchema } from "./schema";

export const DEFAULT_TIMEOUT_MS = 10_000;

function resolveSignal(
  contextSignal?: AbortSignal,
  contextTimeoutMs?: number,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): AbortSignal {
  const timeoutMs =
    options?.timeoutMs ?? contextTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const externalSignal = options?.signal ?? contextSignal;
  return externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal;
}

export const sendAlert = async (
  {
    monitor,
    notification,
    cronTimestamp,
    statusCode,
    latency,
    message,
    signal,
    timeoutMs,
  }: NotificationContext,
  options?: { timeoutMs?: number; signal?: AbortSignal },
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

  const res = await safeFetch(notificationData.webhook.endpoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(notificationData.webhook.headers ?? []),
    },
    signal: resolveSignal(signal, timeoutMs, options),
  });
  if (!res.ok) {
    throw new Error(`Failed to send webhook notification: ${res.statusText}`);
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
    signal,
    timeoutMs,
  }: NotificationContext,
  options?: { timeoutMs?: number; signal?: AbortSignal },
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
  const res = await safeFetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(notificationData.webhook.headers ?? []),
    },
    signal: resolveSignal(signal, timeoutMs, options),
  });
  if (!res.ok) {
    throw new Error(`Failed to send webhook notification: ${res.statusText}`);
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
    signal,
    timeoutMs,
  }: NotificationContext,
  options?: { timeoutMs?: number; signal?: AbortSignal },
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

  const res = await safeFetch(notificationData.webhook.endpoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...transformHeaders(notificationData.webhook.headers ?? []),
    },
    signal: resolveSignal(signal, timeoutMs, options),
  });
  if (!res.ok) {
    throw new Error(`Failed to send webhook notification: ${res.statusText}`);
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
    const response = await safeFetch(url, {
      method: "post",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...transformHeaders(headers ?? []),
      },
      signal: resolveSignal(signal, timeoutMs),
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
