import type {
  Incident,
  Monitor,
  Notification,
} from "@openstatus/db/src/schema";
import { whatsappDataSchema } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";
import { env } from "./env";

export const sendAlert = async ({
  monitor,
  notification,
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
  const notificationData = whatsappDataSchema.parse(
    JSON.parse(notification.data),
  );
  const contentVariables = JSON.stringify({ url: monitor.url });

  const body = new FormData();
  body.set("To", `whatsapp:${notificationData.whatsapp}`);
  body.set("From", "whatsapp:+14807252613");
  body.set("ContentSid", "HX8282106bfaecb7939e69f9c5564babe5");
  body.set("ContentVariables", contentVariables);

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
    throw new Error(`Failed to send WhatsApp message: ${res.statusText}`);
  }
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
  latency?: number;
  region?: Region;
}) => {
  const notificationData = whatsappDataSchema.parse(
    JSON.parse(notification.data),
  );
  const contentVariables = JSON.stringify({ url: monitor.url });

  const body = new FormData();
  body.set("To", `whatsapp:${notificationData.whatsapp}`);
  body.set("From", "whatsapp:+14807252613");
  body.set("ContentSid", "HX8fdeb4201bed18ac8838b3c0135bbf28");
  body.set("ContentVariables", contentVariables);

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
  const notificationData = whatsappDataSchema.parse(
    JSON.parse(notification.data),
  );
  const contentVariables = JSON.stringify({ url: monitor.url });

  const body = new FormData();
  body.set("To", `whatsapp:${notificationData.whatsapp}`);
  body.set("From", "whatsapp:+14807252613");
  body.set("ContentSid", "HX35589f2e7ac8b8be63f4bd62a60e435f");
  body.set("ContentVariables", contentVariables);

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

export const sendTest = async ({ phoneNumber }: { phoneNumber: string }) => {
  const contentVariables = JSON.stringify({ url: "https://openstat.us" });
  const body = new FormData();
  body.set("To", `whatsapp:${phoneNumber}`);
  body.set("ContentSid", "HX36ac9074ebda4376c7d6ddd1690b5291");
  body.set("From", "whatsapp:+14807252613");
  body.set("ContentVariables", contentVariables);

  console.log("send data");
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
