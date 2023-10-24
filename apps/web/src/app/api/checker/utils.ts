import type { z } from "zod";

import type {
  basicMonitorSchema,
  providerName,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { send as sendEmail } from "@openstatus/notification-emails";
import { sendSlackMessage } from "@openstatus/notification-slack";

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
  slack: sendSlackMessage,
  discord: async ({
    monitor,
    notification,
  }: {
    monitor: any;
    notification: any;
  }) => {
    /* TODO: implement */
  },
} satisfies Record<ProviderName, sendNotificationType>;
