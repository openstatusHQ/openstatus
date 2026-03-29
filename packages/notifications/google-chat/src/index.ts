import { googleChatDataSchema } from "@openstatus/db/src/schema";
import type { NotificationContext } from "@openstatus/notification-base";
import { assertSafeUrl } from "@openstatus/utils";

const postToWebhook = async (content: string, webhookUrl: string) => {
  await assertSafeUrl(webhookUrl);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: content,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to send Google Chat webhook: ${res.status} ${res.statusText}`,
    );
  }
};

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
  cronTimestamp,
}: NotificationContext) => {
  const notificationData = googleChatDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { "google-chat": webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `*🚨 Alert <${monitor.url}|${name}>*\nStatus Code: ${
        statusCode || "_empty_"
      }\nMessage: ${
        message || "_empty_"
      }\nCron Timestamp: ${cronTimestamp} (${new Date(
        cronTimestamp,
      ).toISOString()})\n> Check your <https://www.openstatus.dev/app/|Dashboard>.\n`,
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
}: NotificationContext) => {
  const notificationData = googleChatDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { "google-chat": webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `*✅ Recovered <${monitor.url}|${name}>*\n> Check your <https://www.openstatus.dev/app/|Dashboard>.\n`,
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
}: NotificationContext) => {
  const notificationData = googleChatDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { "google-chat": webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `*⚠️ Degraded <${monitor.url}|${name}>*\n> Check your <https://www.openstatus.dev/app/|Dashboard>.\n`,
      webhookUrl,
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const sendTest = async (webhookUrl: string) => {
  if (!webhookUrl) {
    return false;
  }
  console.log(webhookUrl);
  try {
    await postToWebhook(
      "*🧪 Test <https://www.openstatus.dev/|OpenStatus>*\nIf you can read this, your Google Chat webhook is functioning correctly!\n> Check your <https://www.openstatus.dev/app/|Dashboard>.\n",
      webhookUrl,
    );
    return true;
  } catch (_err) {
    console.log(_err);
    return false;
  }
};
