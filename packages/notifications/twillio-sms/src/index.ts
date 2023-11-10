import type { Monitor, Notification } from "@openstatus/db/src/schema";

import { env } from "./env";
import { SmsConfigurationSchema } from "./schema/config";

export const sendTextMessage = async ({
  monitor,
  notification,
  region,
  statusCode,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode: number;
  region: string;
}) => {
  const notificationData = SmsConfigurationSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const body = new FormData();
  body.set("To", notificationData.phoneNumber);
  body.set("From", "+14807252613");
  body.set(
    "Body",
    `Your monitor ${name} / ${monitor.url} is down in ${region} with status code ${statusCode}`,
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
