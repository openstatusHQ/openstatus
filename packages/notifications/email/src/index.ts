import React from "react";
import { renderAsync } from "@react-email/components";
import type { z } from "zod";

import type {
  basicMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { Alert, resend } from "@openstatus/emails";

import { env } from "../env";
import { EmailConfigurationSchema } from "./schema/config";

export const send = async ({
  monitor,
  notification,
}: {
  monitor: z.infer<typeof basicMonitorSchema>;
  notification: z.infer<typeof selectNotificationSchema>;
}) => {
  const config = EmailConfigurationSchema.parse(notification.data);

  const html = await renderAsync(
    Alert({
      data: {
        monitorName: monitor.name,
        monitorUrl: monitor.url,
        recipientName: config.name,
      },
    }),
  );

  const { to } = config;

  await resend.emails.send({
    to,
    from: "Notifications <ping@openstatus.dev>",
    subject: "Your monitor is down 🚨 ",
    html,
  });
};
