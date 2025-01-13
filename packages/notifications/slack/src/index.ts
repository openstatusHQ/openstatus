import type { Monitor, Notification } from "@openstatus/db/src/schema";
import { DataSchema } from "./schema";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const postToWebhook = async (body: any, webhookUrl: string) => {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.log(e);
    throw e;
  }
};

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
  // biome-ignore lint/correctness/noUnusedVariables: <explanation>
  incidentId,
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
  const { slack: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

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
              text: `
*🚨 Alert <${monitor.url}/|${name}>*\n\n
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
}) => {
  const notificationData = DataSchema.parse(JSON.parse(notification.data));
  const { slack: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

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
  cronTimestamp: number;
}) => {
  const notificationData = DataSchema.parse(JSON.parse(notification.data));
  const { slack: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

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
  } catch (err) {
    console.log(err);
    // Do something
  }
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
