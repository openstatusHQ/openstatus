import type {
  Incident,
  Monitor,
  Notification,
} from "@openstatus/db/src/schema";

import { ntfyDataSchema } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = ntfyDataSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const body = `Your monitor ${name} / ${monitor.url} is down with ${
    statusCode ? `status code ${statusCode}` : `error: ${message}`
  }`;

  const authorization = notificationData.ntfy.token
    ? { Authorization: `Bearer ${notificationData.ntfy.token}` }
    : undefined;

  const url = notificationData.ntfy.serverUrl
    ? `${notificationData.ntfy.serverUrl}/${notificationData.ntfy.topic}`
    : `https://ntfy.sh/${notificationData.ntfy.topic}`;

  const res = await fetch(url, {
    method: "post",
    body,
    headers: {
      ...authorization,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to send alert notification: ${res.statusText}`);
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = ntfyDataSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const body = `Your monitor ${name} / ${monitor.url} is up again`;
  const authorization = notificationData.ntfy.token
    ? { Authorization: `Bearer ${notificationData.ntfy.token}` }
    : undefined;

  const url = notificationData.ntfy.serverUrl
    ? `${notificationData.ntfy.serverUrl}/${notificationData.ntfy.topic}`
    : `https://ntfy.sh/${notificationData.ntfy.topic}`;

  const res = await fetch(url, {
    method: "post",
    body,
    headers: {
      ...authorization,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to send recovery notification: ${res.statusText}`);
  }
};

export const sendDegraded = async ({
  monitor,
  notification,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = ntfyDataSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const body = `Your monitor ${name} / ${monitor.url} is degraded `;

  const authorization = notificationData.ntfy
    ? { Authorization: `Bearer ${notificationData.ntfy.token}` }
    : undefined;

  const url = notificationData.ntfy.serverUrl
    ? `${notificationData.ntfy.serverUrl}/${notificationData.ntfy.topic}`
    : `https://ntfy.sh/${notificationData.ntfy.topic}`;

  const res = await fetch(url, {
    method: "post",
    body,
    headers: {
      ...authorization,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to send degraded notification: ${res.statusText}`);
  }
};

export const sendTest = async ({
  serverUrl,
  topic,
  token,
}: {
  topic: string;
  serverUrl?: string;
  token?: string;
}) => {
  const authorization = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;
  const url = serverUrl ? `${serverUrl}/${topic}` : `https://ntfy.sh/${topic}`;
  try {
    await fetch(url, {
      method: "post",
      body: "This is a test message from OpenStatus",
      headers: {
        ...authorization,
      },
    });
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
};
