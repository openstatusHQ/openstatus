import type {
  Incident,
  Monitor,
  Notification,
} from "@openstatus/db/src/schema";
import { discordDataSchema } from "@openstatus/db/src/schema";
import { buildCommonMessageData } from "@openstatus/notification-base";
import {
  type DiscordEmbed,
  buildAlertEmbed,
  buildDegradedEmbed,
  buildRecoveryEmbed,
} from "./embeds";

const postToWebhook = async (embeds: DiscordEmbed[], webhookUrl: string) => {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds,
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
  latency,
  regions,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  latency?: number;
  regions?: string[];
}) => {
  const notificationData = discordDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { discord: webhookUrl } = notificationData;

  const context = {
    monitor,
    notification,
    statusCode,
    message,
    cronTimestamp,
    latency,
    regions,
  };

  const data = buildCommonMessageData(context);
  const embed = buildAlertEmbed(data);

  await postToWebhook([embed], webhookUrl);
};

export const sendRecovery = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
  cronTimestamp,
  latency,
  regions,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  latency?: number;
  regions?: string[];
}) => {
  const notificationData = discordDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { discord: webhookUrl } = notificationData;

  const context = {
    monitor,
    notification,
    statusCode,
    message,
    cronTimestamp,
    latency,
    regions,
  };

  const data = buildCommonMessageData(context, { incident });
  const embed = buildRecoveryEmbed(data);

  await postToWebhook([embed], webhookUrl);
};

export const sendDegraded = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
  cronTimestamp,
  latency,
  regions,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  latency?: number;
  regions?: string[];
}) => {
  const notificationData = discordDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { discord: webhookUrl } = notificationData;

  const context = {
    monitor,
    notification,
    statusCode,
    message,
    cronTimestamp,
    latency,
    regions,
  };

  const data = buildCommonMessageData(context, { incident });
  const embed = buildDegradedEmbed(data);

  await postToWebhook([embed], webhookUrl);
};

export const sendTestDiscordMessage = async (webhookUrl: string) => {
  if (!webhookUrl) {
    return false;
  }
  try {
    const testEmbed: DiscordEmbed = {
      title: "🧪 Test OpenStatus",
      description:
        "If you can read this, your Discord webhook is functioning correctly!",
      color: 5763719, // green
      fields: [],
      timestamp: new Date().toISOString(),
      footer: {
        text: "OpenStatus",
      },
      url: "https://www.openstatus.dev/app/",
    };
    await postToWebhook([testEmbed], webhookUrl);
    return true;
  } catch (_err) {
    return false;
  }
};
