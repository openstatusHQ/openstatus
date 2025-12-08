import type { Monitor, Notification } from "@openstatus/db/src/schema";
import { telegramDataSchema } from "@openstatus/db/src/schema";

import type { Region } from "@openstatus/db/src/schema/constants";

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
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
  latency?: number;
  region?: Region;
}) => {
  const notificationData = telegramDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const body = `Your monitor ${name} / ${monitor.url} is down with ${
    statusCode ? `status code ${statusCode}` : `error: ${message}`
  }`;

  try {
    await sendMessage({
      chatId: notificationData.telegram.chatId,
      message: body,
    });
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
  latency?: number;
  region?: Region;
}) => {
  const notificationData = telegramDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const body = `Your monitor ${name} / ${monitor.url} is up again`;
  try {
    await sendMessage({
      chatId: notificationData.telegram.chatId,
      message: body,
    });
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
  incidentId?: string;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => {
  const notificationData = telegramDataSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const body = `Your monitor ${name} / ${monitor.url} is degraded `;

  try {
    await sendMessage({
      chatId: notificationData.telegram.chatId,
      message: body,
    });
  } catch (err) {
    console.log(err);
    // Do something
  }
};

export const sendTest = async ({ chatId }: { chatId: string }) => {
  try {
    await sendMessage({
      chatId,
      message: "This is a test message from OpenStatus. You are good to go!",
    });
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
};

export async function sendMessage({
  chatId,
  message,
}: {
  chatId: string;
  message: string;
}) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  return fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=${message}`,
  );
}
