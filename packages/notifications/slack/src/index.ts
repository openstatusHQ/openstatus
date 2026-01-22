import type { Incident, Monitor, Notification } from "@openstatus/db/src/schema";
import { slackDataSchema } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";
import { buildCommonMessageData } from "@openstatus/notification-base";
import {
  buildAlertBlocks,
  buildRecoveryBlocks,
  buildDegradedBlocks,
} from "./blocks";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const postToWebhook = async (body: any, webhookUrl: string) => {
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
  region,
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
  const notificationData = slackDataSchema.parse(JSON.parse(notification.data));
  const { slack: webhookUrl } = notificationData;

  const context = {
    monitor,
    notification,
    statusCode,
    message,
    cronTimestamp,
    latency,
    region,
  };

  const data = buildCommonMessageData(context);
  const blocks = buildAlertBlocks(data);

  await postToWebhook({ blocks }, webhookUrl);
};

export const sendRecovery = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
  cronTimestamp,
  region,
  latency,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  region?: Region;
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
    region,
  };

  const data = buildCommonMessageData(context, { incident });
  const blocks = buildRecoveryBlocks(data);

  await postToWebhook({ blocks }, webhookUrl);
};

export const sendDegraded = async ({
  monitor,
  notification,
  statusCode,
  message,
  incident,
  cronTimestamp,
  region,
  latency,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
  cronTimestamp: number;
  region?: Region;
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
    region,
  };

  const data = buildCommonMessageData(context, { incident });
  const blocks = buildDegradedBlocks(data);

  await postToWebhook({ blocks }, webhookUrl);
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
