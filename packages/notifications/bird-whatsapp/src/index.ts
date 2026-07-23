import { whatsappDataSchema } from "@openstatus/db/src/schema";
import type { NotificationContext } from "@openstatus/notification-base";

import { env } from "./env";

const TEMPLATES = {
  alert: {
    projectId: "20cd47e2-70e9-4e06-97be-21eee5e4de33",
    version: "9a86655b-9e5a-4e8a-80f3-33f232bb7e63",
  },
  recovery: {
    projectId: "2068001e-330d-4093-8d06-7071e9d34aa1",
    version: "af66e5de-015b-4822-a34e-fb6dfd538bb6",
  },
  degraded: {
    projectId: "c9a842d9-cf9e-4a13-8cde-024d57e29143",
    version: "dcbfac35-db0e-4e07-9390-e53dda2fda0b",
  },
  test: {
    projectId: "3315bcd8-2fde-411c-83c5-009ac4b4b8ff",
    version: "a3e55807-ff35-4dbc-a16b-670c7eeaae85",
  },
} as const;

async function sendMessage(
  phoneNumber: string,
  monitorUrl: string,
  template: { projectId: string; version: string },
): Promise<void> {
  const res = await fetch(
    `https://api.bird.com/workspaces/${env.BIRD_WORKSPACE_ID}/channels/${env.BIRD_CHANNEL_ID}/batch/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `AccessKey ${env.BIRD_ACCESS_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageRequests: [
          {
            receiver: {
              contacts: [
                {
                  identifierKey: "phonenumber",
                  identifierValue: phoneNumber,
                },
              ],
            },
            template: {
              projectId: template.projectId,
              version: template.version,
              locale: "en",
              parameters: [
                {
                  type: "string",
                  key: "monitor_url",
                  value: monitorUrl,
                },
              ],
            },
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to send WhatsApp message: ${res.statusText}`);
  }
}

export const sendAlert = async ({
  monitor,
  notification,
}: NotificationContext) => {
  const notificationData = whatsappDataSchema.parse(
    JSON.parse(notification.data),
  );
  await sendMessage(notificationData.whatsapp, monitor.url, TEMPLATES.alert);
};

export const sendRecovery = async ({
  monitor,
  notification,
}: NotificationContext) => {
  const notificationData = whatsappDataSchema.parse(
    JSON.parse(notification.data),
  );
  await sendMessage(notificationData.whatsapp, monitor.url, TEMPLATES.recovery);
};

export const sendDegraded = async ({
  monitor,
  notification,
}: NotificationContext) => {
  const notificationData = whatsappDataSchema.parse(
    JSON.parse(notification.data),
  );
  await sendMessage(notificationData.whatsapp, monitor.url, TEMPLATES.degraded);
};

export const sendTest = async ({ phoneNumber }: { phoneNumber: string }) => {
  try {
    await sendMessage(phoneNumber, "https://openstat.us", TEMPLATES.test);
  } catch (err) {
    console.log(err);
  }
};
