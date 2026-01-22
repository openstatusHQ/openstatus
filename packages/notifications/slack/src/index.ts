import type { Incident, Monitor, Notification } from "@openstatus/db/src/schema";
import { slackDataSchema } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";

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
  const { slack: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

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
            text: `
*🚨 Alert <${monitor.url}|${name}>*\n\n
Status Code: ${statusCode || "_empty_"}\n
Message: ${message || "_empty_"}\n
Cron Timestamp: ${cronTimestamp} (${new Date(cronTimestamp).toISOString()})
`,
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
  region?: Region;
  latency?: number;
}) => {
  const notificationData = slackDataSchema.parse(JSON.parse(notification.data));
  const { slack: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

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
            text: `*✅ Recovered <${monitor.url}/|${name}>*`,
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
  region?: Region;
  latency?: number;
}) => {
  const notificationData = slackDataSchema.parse(JSON.parse(notification.data));
  const { slack: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

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
            text: `*⚠️ Degraded <${monitor.url}/|${name}>*`,
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
