import type {
  Monitor,
  Notification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import { sendDiscordMessage } from "@openstatus/notification-discord";
import { send as sendEmail } from "@openstatus/notification-emails";
import { sendSlackMessage } from "@openstatus/notification-slack";

// type sendNotificationType = ({
//   monitor,
//   notification,
// }: {
//   monitor: Monitor;
//   notification: Notification;
// }) => Promise<void>;

// export const providerToFunction = {
//   email: sendEmail,
//   slack: sendSlackMessage,
//   discord: sendDiscordMessage,
// } satisfies Record<NotificationProvider, sendNotificationType>;
