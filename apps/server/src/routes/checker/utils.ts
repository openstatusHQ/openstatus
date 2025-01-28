import type {
  Monitor,
  Notification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import {
  sendAlert as sendDiscordAlert,
  sendDegraded as sendDiscordDegraded,
  sendRecovery as sendDiscordRecovery,
} from "@openstatus/notification-discord";
import {
  sendAlert as sendEmailAlert,
  sendDegraded as sendEmailDegraded,
  sendRecovery as sendEmailRecovery,
} from "@openstatus/notification-emails";
import {
  sendAlert as sendSlackAlert,
  sendDegraded as sendSlackDegraded,
  sendRecovery as sendSlackRecovery,
} from "@openstatus/notification-slack";
import {
  sendAlert as sendSmsAlert,
  sendDegraded as sendSmsDegraded,
  sendRecovery as sendSmsRecovery,
} from "@openstatus/notification-twillio-sms";

import {
  sendDegraded as sendPagerDutyDegraded,
  sendRecovery as sendPagerDutyRecovery,
  sendAlert as sendPagerdutyAlert,
} from "@openstatus/notification-pagerduty";

import {
  sendAlert as sendOpsGenieAlert,
  sendDegraded as sendOpsGenieDegraded,
  sendRecovery as sendOpsGenieRecovery,
} from "@openstatus/notification-opsgenie";

type SendNotification = ({
  monitor,
  notification,
  statusCode,
  message,
  incidentId,
  cronTimestamp,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
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
  opsgenie: {
    sendAlert: sendOpsGenieAlert,
    sendRecovery: sendOpsGenieRecovery,
    sendDegraded: sendOpsGenieDegraded,
  },
  pagerduty: {
    sendAlert: sendPagerdutyAlert,
    sendRecovery: sendPagerDutyRecovery,
    sendDegraded: sendPagerDutyDegraded,
  },
} satisfies Record<NotificationProvider, Notif>;
