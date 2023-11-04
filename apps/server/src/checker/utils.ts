import type {
  Monitor,
  Notification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import { sendDiscordMessage } from "@openstatus/notification-discord";
import { send as sendEmail } from "@openstatus/notification-emails";
import { sendSlackMessage } from "@openstatus/notification-slack";
import type { flyRegionsDict } from "@openstatus/utils";

type SendNotification = ({
  monitor,
  notification,
  region,
  statusCode,
}: {
  monitor: Monitor;
  notification: Notification;
  region: keyof typeof flyRegionsDict;
  statusCode: number;
}) => Promise<void>;

export const providerToFunction = {
  email: sendEmail,
  slack: sendSlackMessage,
  discord: sendDiscordMessage,
} satisfies Record<NotificationProvider, SendNotification>;
