import type {
  Monitor,
  Notification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import {
  sendAlert as sendDiscordAlert,
  sendRecovery as sendDiscordRecovery,
  sendDegraded as sendDiscordDegraded,
} from "@openstatus/notification-discord";
import {
  sendAlert as sendEmailAlert,
  sendRecovery as sendEmailRecovery,
  sendDegraded as sendEmailDegraded,
} from "@openstatus/notification-emails";
import {
  sendAlert as sendSlackAlert,
  sendRecovery as sendSlackRecovery,
  sendDegraded as sendSlackDegraded,
} from "@openstatus/notification-slack";
import {
  sendAlert as sendSmsAlert,
  sendRecovery as sendSmsRecovery,
  sendDegraded as sendSmsDegraded,
} from "@openstatus/notification-twillio-sms";

type SendNotification = ({
  monitor,
  notification,
  statusCode,
  message,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
}) => Promise<void>;

type Notif = {
  sendAlert: SendNotification;
  sendRecovery: SendNotification;
  sendDegraded: SendNotification;
};
export const providerToFunction = {
  email: {
    sendAlert: sendEmailAlert,
    sendRecovery: sendEmailRecovery,
    sendDegraded: sendEmailDegraded,
  },
  slack: {
    sendAlert: sendSlackAlert,
    sendRecovery: sendSlackRecovery,
    sendDegraded: sendSlackDegraded,
  },
  discord: {
    sendAlert: sendDiscordAlert,
    sendRecovery: sendDiscordRecovery,
    sendDegraded: sendDiscordDegraded,
  },
  sms: {
    sendAlert: sendSmsAlert,
    sendRecovery: sendSmsRecovery,
    sendDegraded: sendSmsDegraded,
  },
} satisfies Record<NotificationProvider, Notif>;
