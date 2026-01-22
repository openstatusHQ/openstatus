import { slackDataSchema } from "@openstatus/db/src/schema";
import {
  type NotificationContext,
  buildCommonMessageData,
} from "@openstatus/notification-base";
import {
  buildAlertBlocks,
  buildDegradedBlocks,
  buildRecoveryBlocks,
} from "./blocks";

/**
 * Slack attachment colors (hex values)
 * Reference: https://api.slack.com/reference/messaging/attachments#color
 */
const COLORS = {
  red: "#ED4245", // Alert/Error - red left border
  yellow: "#FEE75C", // Degraded/Warning - yellow/orange left border
  green: "#57F287", // Recovery/Success - green left border
} as const;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const postToWebhook = async (body: any, webhookUrl: string) => {
  if (!webhookUrl || webhookUrl.trim() === "") {
    throw new Error("Slack webhook URL is required");
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Failed to send Slack notification: ${res.statusText}`);
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
  const notificationData = slackDataSchema.parse(JSON.parse(notification.data));
  const { slack: webhookUrl } = notificationData;

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
  const blocks = buildAlertBlocks(data);

  await postToWebhook(
    {
      attachments: [
        {
          color: COLORS.red,
          blocks,
        },
      ],
    },
    webhookUrl,
  );
};

export const sendRecovery = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
  cronTimestamp,
  regions,
  latency,
}: NotificationContext) => {
  const notificationData = slackDataSchema.parse(JSON.parse(notification.data));
  const { slack: webhookUrl } = notificationData;

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
  const blocks = buildRecoveryBlocks(data);

  await postToWebhook(
    {
      attachments: [
        {
          color: COLORS.green,
          blocks,
        },
      ],
    },
    webhookUrl,
  );
};

export const sendDegraded = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
  cronTimestamp,
  regions,
  latency,
}: NotificationContext) => {
  const notificationData = slackDataSchema.parse(JSON.parse(notification.data));
  const { slack: webhookUrl } = notificationData;

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
  const blocks = buildDegradedBlocks(data);

  await postToWebhook(
    {
      attachments: [
        {
          color: COLORS.yellow,
          blocks,
        },
      ],
    },
    webhookUrl,
  );
};

export const sendTestSlackMessage = async (webhookUrl: string) => {
  await postToWebhook(
    {
      attachments: [
        {
          color: COLORS.green,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "Test Notification",
                emoji: false,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "`🧪 Your Slack webhook is configured correctly!`",
              },
            },
            {
              type: "divider",
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: "*Status*\nWebhook Connected",
                },
                {
                  type: "mrkdwn",
                  text: "*Type*\nTest Notification",
                },
              ],
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*Next Steps*\nYou will receive notifications here when your monitors trigger fails, recovers, or become degraded.",
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "View Dashboard",
                    emoji: true,
                  },
                  url: "https://app.openstatus.dev",
                  action_id: "view_dashboard",
                },
              ],
            },
          ],
        },
      ],
    },
    webhookUrl,
  );
};
