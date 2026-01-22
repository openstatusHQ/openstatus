import type { Incident, Monitor, Notification } from "@openstatus/db/src/schema";
import { discordDataSchema } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";

const postToWebhook = async (content: string, webhookUrl: string) => {
  const res = await fetch(webhookUrl, {
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
  if (!res.ok) {
    throw new Error(
      `Failed to send Discord webhook: ${res.status} ${res.statusText}`,
    );
  }
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
  incident?: Incident;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = discordDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { discord: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `**🚨 Alert [${name}](<${monitor.url}>)**\nStatus Code: ${
        statusCode || "_empty_"
      }\nMessage: ${
        message || "_empty_"
      }\nCron Timestamp: ${cronTimestamp} (${new Date(
        cronTimestamp,
      ).toISOString()})\n> Check your [Dashboard](<https://www.openstatus.dev/app/>).\n`,
      webhookUrl,
    );
  } catch (err) {
    console.error(err);
    throw err;
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
  const notificationData = discordDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { discord: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `**✅ Recovered [${name}](<${monitor.url}>)**\n> Check your [Dashboard](<https://www.openstatus.dev/app/>).\n`,
      webhookUrl,
    );
  } catch (err) {
    console.error(err);
    throw err;
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
  const notificationData = discordDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { discord: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `**⚠️ Degraded [${name}](<${monitor.url}>)**\n> Check your [Dashboard](<https://www.openstatus.dev/app/>).\n`,
      webhookUrl,
    );
  } catch (err) {
    console.error(err);
    throw err;
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
