import { selectNotificationSchema, type Monitor, type Notification } from "@openstatus/db/src/schema";

import type { Region } from "@openstatus/db/src/schema/constants";
import { SmsConfigurationSchema } from "./schema/config";
import { env } from "./env";

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
  const notificationData = SmsConfigurationSchema.parse(
    JSON.parse(notification.data),
  );
  const { name } = monitor;

  const contentVariables = JSON.stringify({url:monitor.url})
  const body = new FormData();
  body.set("To", `whatsapp:${notificationData.sms}`);
  body.set('ContentSid',"HX8282106bfaecb7939e69f9c5564babe5")
  body.set("From", "whatsapp:+14807252613");
  body.set("ContentVariables",contentVariables)
  // body.set("Body", `Your monitor ${name} / ${monitor.url} is degraded `);

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


const a = {
  id: 1,
  name: "slack Notification",
  provider: "slack",
  workspaceId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),

  data: '{"sms":"+12345678900"}',
};

const n = selectNotificationSchema.parse(a);

await sendDegraded({
  // @ts-expect-error
  monitor: {
    id: 1,
    name: "API Health Check",
    url: "https://api.example.com/health",
    jobType: "http" as const,
    periodicity: "10m" as const,
    status: "active" as const, // or "down", "degraded"
    createdAt: new Date(),
    updatedAt: new Date(),
    regions: ["ams"],
  },
  notification:n,
  statusCode: 500,
  message: "Something went wrong",
  cronTimestamp: Date.now(),
})
