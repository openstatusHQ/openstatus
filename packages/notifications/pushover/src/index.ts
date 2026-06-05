import { pushoverDataSchema } from "@openstatus/db/src/schema";
import type { NotificationContext } from "@openstatus/notification-base";

const PUSHOVER_API_URL = "https://api.pushover.net/1/messages.json";

async function send({
  token,
  user,
  priority,
  title,
  message,
  url,
}: {
  token: string;
  user: string;
  priority: number;
  title: string;
  message: string;
  url?: string;
}) {
  const body = new URLSearchParams({
    token,
    user,
    title,
    message,
    priority: String(priority),
  });
  // Pushover validates the `url` param, so only attach it for real http(s)
  // links — a tcp/dns monitor's `url` (e.g. "host:port") would be rejected.
  if (url?.startsWith("http")) {
    body.set("url", url);
    body.set("url_title", "View monitor");
  }

  const res = await fetch(PUSHOVER_API_URL, {
    method: "post",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Failed to send pushover notification: ${res.statusText}`);
  }
}

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
}: NotificationContext) => {
  const { pushover } = pushoverDataSchema.parse(JSON.parse(notification.data));
  await send({
    ...pushover,
    title: `${monitor.name} is down`,
    message: `Your monitor ${monitor.name} / ${monitor.url} is down with ${
      statusCode ? `status code ${statusCode}` : `error: ${message}`
    }`,
    url: monitor.url,
  });
};

export const sendRecovery = async ({
  monitor,
  notification,
}: NotificationContext) => {
  const { pushover } = pushoverDataSchema.parse(JSON.parse(notification.data));
  // Recovery is never urgent: force normal priority so "up again" can't
  // bypass the user's Pushover quiet hours.
  await send({
    ...pushover,
    priority: 0,
    title: `${monitor.name} is up`,
    message: `Your monitor ${monitor.name} / ${monitor.url} is up again`,
    url: monitor.url,
  });
};

export const sendDegraded = async ({
  monitor,
  notification,
}: NotificationContext) => {
  const { pushover } = pushoverDataSchema.parse(JSON.parse(notification.data));
  await send({
    ...pushover,
    title: `${monitor.name} is degraded`,
    message: `Your monitor ${monitor.name} / ${monitor.url} is degraded`,
    url: monitor.url,
  });
};

export const sendTest = async ({
  token,
  user,
  priority = 0,
}: {
  token: string;
  user: string;
  priority?: number;
}) => {
  await send({
    token,
    user,
    priority,
    title: "OpenStatus",
    message: "This is a test message from OpenStatus",
  });
  return true;
};
