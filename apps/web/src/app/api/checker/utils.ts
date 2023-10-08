import type { z } from "zod";

import type {
  basicMonitorSchema,
  providerName,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { sendDiscordMessage } from "@openstatus/notification-discord";
import { send as sendEmail } from "@openstatus/notification-emails";

type ProviderName = (typeof providerName)[number];

type sendNotificationType = ({
  monitor,
  notification,
}: {
  monitor: z.infer<typeof basicMonitorSchema>;
  notification: z.infer<typeof selectNotificationSchema>;
}) => Promise<void>;

export const providerToFunction = {
  email: sendEmail,
  slack: async ({
    monitor,
    notification,
  }: {
    monitor: any;
    notification: any;
  }) => {
    /* TODO: implement */
  },
  discord: sendDiscordMessage,
} satisfies Record<ProviderName, sendNotificationType>;
