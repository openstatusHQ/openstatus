import type {
  Monitor,
  Notification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import { sendDiscordMessage } from "@openstatus/notification-discord";
import { send as sendEmail } from "@openstatus/notification-emails";
import { sendSlackMessage } from "@openstatus/notification-slack";
import { sendTextMessage } from "@openstatus/notification-twillio-sms";
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
  sms: sendTextMessage,
} satisfies Record<NotificationProvider, SendNotification>;
