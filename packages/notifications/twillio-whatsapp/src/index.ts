import type { Monitor, Notification } from "@openstatus/db/src/schema";
import { whatsappDataSchema } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";
import { env } from "./env";

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
  const notificationData = whatsappDataSchema.parse(
    JSON.parse(notification.data),
  );
  const contentVariables = JSON.stringify({url:monitor.url})

  const body = new FormData();
  body.set("To", `whatsapp:${notificationData.whatsapp}`);
  body.set("From", "whatsapp:+14807252613");
  body.set('ContentSid',"HX8282106bfaecb7939e69f9c5564babe5")
  body.set("ContentVariables",contentVariables)


  try {
    await fetch(
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
  latency?: number;
  region?: Region;
}) => {
  const notificationData = whatsappDataSchema.parse(
    JSON.parse(notification.data),
  );
  const contentVariables = JSON.stringify({url:monitor.url})

  const body = new FormData();
  body.set("To", `whatsapp:${notificationData.whatsapp}`);
  body.set("From", "whatsapp:+14807252613");
  body.set('ContentSid',"HX8fdeb4201bed18ac8838b3c0135bbf28")
  body.set("ContentVariables",contentVariables)

  try {
    await fetch(
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
  latency?: number;
  region?: Region;
}) => {
  const notificationData = whatsappDataSchema.parse(
    JSON.parse(notification.data),
  );
  const contentVariables = JSON.stringify({url:monitor.url})

  const body = new FormData();
  body.set("To", `whatsapp:${notificationData.whatsapp}`);
  body.set("From", "whatsapp:+14807252613");
  body.set('ContentSid',"HX35589f2e7ac8b8be63f4bd62a60e435f")
  body.set("ContentVariables",contentVariables)

  try {
    await fetch(
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

export const sendTest = async({phoneNumber}: {phoneNumber:string}) => {

  const contentVariables = JSON.stringify({url:"https://openstat.us"})
  const body = new FormData();
  body.set("To", `whatsapp:${phoneNumber}`);
  body.set('ContentSid',"HX8282106bfaecb7939e69f9c5564babe5")
  body.set("From", "whatsapp:+14807252613");
  body.set("ContentVariables",contentVariables)

  try {
    await fetch(
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
