import type {
  Incident,
  Monitor,
  Notification,
} from "@openstatus/db/src/schema";
import { slackDataSchema } from "@openstatus/db/src/schema";
import { buildCommonMessageData } from "@openstatus/notification-base";
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
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
      text: `${monitor.name} is failing - ${monitor.url}`,
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
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  regions?: string[];
  latency?: number;
}) => {
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
      text: `${monitor.name} is recovered - ${monitor.url}`,
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
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  regions?: string[];
  latency?: number;
}) => {
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
      text: `${monitor.name} is degraded - ${monitor.url}`,
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
  try {
    await postToWebhook(
      {
        blocks: [
          {
            type: "divider",
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*🧪 Test <https://www.openstatus.dev/|OpenStatus>*\n\nIf you can read this, your Slack webhook is functioning correctly!",
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Check your <https://www.openstatus.dev/app|Dashboard>.",
              },
            ],
          },
        ],
      },
      webhookUrl,
    );
    return true;
  } catch (_err) {
    return false;
  }
};
