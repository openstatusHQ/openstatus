import { Resend } from "resend";
import type { z } from "zod";

import type {
  basicMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { Alert } from "@openstatus/emails";

import { env } from "../env";
import { EmailConfigurationSchema } from "./schema/config";

const resend = new Resend(env.RESEND_API_KEY);

export const send = async ({
  monitor,
  notification,
}: {
  monitor: z.infer<typeof basicMonitorSchema>;
  notification: z.infer<typeof selectNotificationSchema>;
}) => {
  const config = EmailConfigurationSchema.parse(notification.data);

  const { to } = config;

  await resend.emails.send({
    to,
    from: "Notifications <ping@openstatus.dev>",
    subject: "Welcome to OpenStatus",
    react: Alert({
      data: {
        monitorName: monitor.name,
        monitorUrl: monitor.url,
        recipientName: config.name,
      },
    }),
  });
};
