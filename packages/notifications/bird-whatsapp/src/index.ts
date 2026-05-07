import { whatsappDataSchema } from "@openstatus/db/src/schema";
import type { NotificationContext } from "@openstatus/notification-base";
import { env } from "./env";

const TEMPLATES = {
  alert: {
    projectId: "446fc1ad-3ff4-40fb-8b11-ebfd02513c5d",
    version: "679aa339-4037-4aa6-8063-ab290249fd14",
  },
  recovery: {
    projectId: "61d6052d-2abf-422a-ab61-a918ab638a83",
    version: "dc8cd91a-f44a-4df8-af0c-f62fcd90df61",
  },
  degraded: {
    projectId: "6ef3a922-1960-444a-b385-2716f157e10b",
    version: "1f1a133c-ab83-477b-b104-3d4a9db6ec7b",
  },
  test: {
    projectId: "43f04cfa-b400-4e70-9389-76fee497f250",
    version: "9478e278-d319-4f26-8682-c689970e1803",
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
