import type { Monitor, Notification } from "@openstatus/db/src/schema";

import type { Region } from "@openstatus/db/src/schema/constants";
import { NtfySchema } from "./schema";

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = NtfySchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const body = `Your monitor ${name} / ${monitor.url} is down with ${
    statusCode ? `status code ${statusCode}` : `error: ${message}`
  }`;

  const authorization = notificationData.token
    ? { Authorization: `Bearer ${notificationData.token}` }
    : undefined;

  const url = notificationData.serverUrl
    ? `${notificationData.serverUrl}/${notificationData.topic}`
    : `https://ntfy.sh/${notificationData.topic}`;

  try {
    await fetch(url, {
      method: "post",
      body,
      headers: {
        ...authorization,
      },
    });
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
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = NtfySchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const body = `Your monitor ${name} / ${monitor.url} is up again`;
  const authorization = notificationData.token
    ? { Authorization: `Bearer ${notificationData.token}` }
    : undefined;

  const url = notificationData.serverUrl
    ? `${notificationData.serverUrl}/${notificationData.topic}`
    : `https://ntfy.sh/${notificationData.topic}`;
  try {
    await fetch(url, {
      method: "post",
      body,
      headers: {
        ...authorization,
      },
    });
  } catch (err) {
    console.log(err);
    // Do something
  }
};

export const sendDegraded = async ({
  monitor,
  notification,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  statusCode,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  message,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = NtfySchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const body = `Your monitor ${name} / ${monitor.url} is degraded `;

  const authorization = notificationData.token
    ? { Authorization: `Bearer ${notificationData.token}` }
    : undefined;

  const url = notificationData.serverUrl
    ? `${notificationData.serverUrl}/${notificationData.topic}`
    : `https://ntfy.sh/${notificationData.topic}`;

  try {
    await fetch(url, {
      method: "post",
      body,
      headers: {
        ...authorization,
      },
    });
  } catch (err) {
    console.log(err);
    // Do something
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
