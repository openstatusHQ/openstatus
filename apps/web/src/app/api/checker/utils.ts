import type {
  Monitor,
  Notification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import { send as sendEmail } from "@openstatus/notification-emails";

type sendNotificationType = ({
  monitor,
  notification,
}: {
  monitor: Monitor;
  notification: Notification;
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
  discord: async ({
    monitor,
    notification,
  }: {
    monitor: any;
    notification: any;
  }) => {
    /* TODO: implement */
  },
} satisfies Record<NotificationProvider, sendNotificationType>;
