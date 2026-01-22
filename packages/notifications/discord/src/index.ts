import { discordDataSchema } from "@openstatus/db/src/schema";
import {
  type NotificationContext,
  buildCommonMessageData,
} from "@openstatus/notification-base";
import {
  type DiscordEmbed,
  buildAlertEmbed,
  buildDegradedEmbed,
  buildRecoveryEmbed,
} from "./embeds";

const postToWebhook = async (embeds: DiscordEmbed[], webhookUrl: string) => {
  if (!webhookUrl || webhookUrl.trim() === "") {
    throw new Error("Discord webhook URL is required");
  }

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
}: NotificationContext) => {
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
}: NotificationContext) => {
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
}: NotificationContext) => {
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
  const testEmbed: DiscordEmbed = {
    title: "Test Notification",
    description: "🧪 Your Discord webhook is configured correctly!",
    color: 5763719, // green
    fields: [
      {
        name: "Status",
        value: "Webhook Connected",
        inline: true,
      },
      {
        name: "Type",
        value: "Test Notification",
        inline: true,
      },
      {
        name: "Next Steps",
        value:
          "You will receive notifications here when your monitors trigger fails, recovers, or become degraded.",
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "openstatus",
    },
    url: "https://www.openstatus.dev/app/",
  };
  await postToWebhook([testEmbed], webhookUrl);
};
