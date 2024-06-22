import type {
  Monitor,
  Notification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import {
  sendAlert as sendDiscordAlert,
  sendRecovery as sendDiscordRecovery,
} from "@openstatus/notification-discord";
import {
  sendAlert as sendEmailAlert,
  sendRecovery as sendEmailRecovery,
} from "@openstatus/notification-emails";
import {
  sendAlert as sendSlackAlert,
  sendRecovery as sendSlackRecovery,
} from "@openstatus/notification-slack";
import {
  sendAlert as sendSmsAlert,
  sendRecovery as sendSmsRecovery,
} from "@openstatus/notification-twillio-sms";

import {
  sendAlert as sendPagerdutyAlert,
  sendRecovery as sendPagerDutyRecovery,
} from "@openstatus/notification-pagerduty";

type SendNotification = ({
  monitor,
  notification,
  statusCode,
  message,
  incidentId,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
}) => Promise<void>;

type Notif = {
  sendAlert: SendNotification;
  sendRecovery: SendNotification;
};
export const providerToFunction = {
  email: {
    sendAlert: sendEmailAlert,
    sendRecovery: sendEmailRecovery,
  },
  slack: {
    sendAlert: sendSlackAlert,
    sendRecovery: sendSlackRecovery,
  },
  discord: { sendAlert: sendDiscordAlert, sendRecovery: sendDiscordRecovery },
  sms: { sendAlert: sendSmsAlert, sendRecovery: sendSmsRecovery },
  pagerduty: {
    sendAlert: sendPagerdutyAlert,
    sendRecovery: sendPagerDutyRecovery,
  },
} satisfies Record<NotificationProvider, Notif>;
