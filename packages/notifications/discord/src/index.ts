import type { Monitor, Notification } from "@openstatus/db/src/schema";

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
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
}) => {
  const notificationData = JSON.parse(notification.data);
  const { discord: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `Your monitor ${name} is down 🚨

      Your monitor with url ${monitor.url} is down with ${
        statusCode ? `status code ${statusCode}` : `error message ${message}`
      }.`,
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
  statusCode,
  message,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
}) => {
  const notificationData = JSON.parse(notification.data);
  const { discord: webhookUrl } = notificationData; // webhook url
  const { name } = monitor;

  try {
    await postToWebhook(
      `Your monitor ${name}|${monitor.url}  is up again 🎉`,
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
      "This is a test notification from OpenStatus. \nIf you see this, it means that your webhook is working! 🎉",
      webhookUrl,
    );
    return true;
  } catch (_err) {
    return false;
  }
};
