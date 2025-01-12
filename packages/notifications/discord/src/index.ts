import type { Monitor, Notification } from "@openstatus/db/src/schema";
import { DataSchema } from "./schema";

const postToWebhook = async (content: string, webhookUrl: string) => {
  await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      avatar_url:
        "https://img.stackshare.io/service/104872/default_dc6948366d9bae553adbb8f51252eafbc5d2043a.jpg",
      username: "OpenStatus Notifications",
    }),
  });
};

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
  cronTimestamp,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
}) => {
  const notificationData = DataSchema.parse(JSON.parse(notification.data));
  const { discord: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `**🚨 Alert [${name}](<${monitor.url}>)**\nStatus Code: ${statusCode || "_empty_"}\nMessage: ${message || "_empty_"}\nCron Timestamp: ${cronTimestamp} (${new Date(cronTimestamp).toISOString()})\n> Check your [Dashboard](<https://www.openstatus.dev/app/>).\n`,
      webhookUrl,
    );
  } catch (err) {
    console.error(err);
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
}) => {
  const notificationData = DataSchema.parse(JSON.parse(notification.data));
  const { discord: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `**✅ Recovered [${name}](<${monitor.url}>)**\n> Check your [Dashboard](<https://www.openstatus.dev/app/>).\n`,
      webhookUrl,
    );
  } catch (err) {
    console.error(err);
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
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
}) => {
  const notificationData = DataSchema.parse(JSON.parse(notification.data));
  const { discord: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `**⚠️ Degraded [${name}](<${monitor.url}>)**\n> Check your [Dashboard](<https://www.openstatus.dev/app/>).\n`,
      webhookUrl,
    );
  } catch (err) {
    console.error(err);
    // Do something
  }
};

export const sendTestDiscordMessage = async (webhookUrl: string) => {
  if (!webhookUrl) {
    return false;
  }
  try {
    await postToWebhook(
      "**🧪 Test [OpenStatus](<https://www.openstatus.dev/>)**\nIf you can read this, your Discord webhook is functioning correctly!\n> Check your [Dashboard](<https://www.openstatus.dev/app/>).\n",
      webhookUrl,
    );
    return true;
  } catch (_err) {
    return false;
  }
};
