import type { Monitor, Notification } from "@openstatus/db/src/schema";

import { env } from "./env";
import { SmsConfigurationSchema } from "./schema/config";

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
}) => {
  const notificationData = SmsConfigurationSchema.parse(
    JSON.parse(notification.data),
  );
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

  try {
    fetch(
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
  const notificationData = SmsConfigurationSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const body = new FormData();
  body.set("To", notificationData.sms);
  body.set("From", "+14807252613");
  body.set("Body", `Your monitor ${name} / ${monitor.url} is up again`);

  try {
    fetch(
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
}) => {
  const notificationData = SmsConfigurationSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const body = new FormData();
  body.set("To", notificationData.sms);
  body.set("From", "+14807252613");
  body.set("Body", `Your monitor ${name} / ${monitor.url} is degraded `);

  try {
    fetch(
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
  } catch (err) {
    console.log(err);
    // Do something
  }
};
