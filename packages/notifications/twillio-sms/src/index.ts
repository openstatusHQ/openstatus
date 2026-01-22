import { phoneDataSchema } from "@openstatus/db/src/schema";
import type { NotificationContext } from "@openstatus/notification-base";
import { env } from "./env";

export const sendAlert = async ({
  monitor,
  notification,
  statusCode,
  message,
}: NotificationContext) => {
  const notificationData = phoneDataSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const body = new FormData();
  body.set("To", notificationData.sms);
  body.set("From", "+14807252613");
  body.set(
    "Body",
    `Your monitor ${name} / ${monitor.url} is down with ${
      statusCode ? `status code ${statusCode}` : `error: ${message}`
    }`,
  );

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILLIO_ACCOUNT_ID}/Messages.json`,
    {
      method: "post",
      body,
      headers: {
        Authorization: `Basic ${btoa(
          `${env.TWILLIO_ACCOUNT_ID}:${env.TWILLIO_AUTH_TOKEN}`,
        )}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to send SMS: ${res.statusText}`);
  }
};

export const sendRecovery = async ({
  monitor,
  notification,
}: NotificationContext) => {
  const notificationData = phoneDataSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const body = new FormData();
  body.set("To", notificationData.sms);
  body.set("From", "+14807252613");
  body.set("Body", `Your monitor ${name} / ${monitor.url} is up again`);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILLIO_ACCOUNT_ID}/Messages.json`,
    {
      method: "post",
      body,
      headers: {
        Authorization: `Basic ${btoa(
          `${env.TWILLIO_ACCOUNT_ID}:${env.TWILLIO_AUTH_TOKEN}`,
        )}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to send SMS: ${res.statusText}`);
  }
};

export const sendDegraded = async ({
  monitor,
  notification,
}: NotificationContext) => {
  const notificationData = phoneDataSchema.parse(JSON.parse(notification.data));
  const { name } = monitor;

  const body = new FormData();
  body.set("To", notificationData.sms);
  body.set("From", "+14807252613");
  body.set("Body", `Your monitor ${name} / ${monitor.url} is degraded `);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILLIO_ACCOUNT_ID}/Messages.json`,
    {
      method: "post",
      body,
      headers: {
        Authorization: `Basic ${btoa(
          `${env.TWILLIO_ACCOUNT_ID}:${env.TWILLIO_AUTH_TOKEN}`,
        )}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to send SMS: ${res.statusText}`);
  }
};
