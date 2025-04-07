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
  sendAlert as sendNtfyAlert,
  sendDegraded as sendNtfyDegraded,
  sendRecovery as sendNtfyRecovery,
} from "@openstatus/notification-ntfy";
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

import type { Region } from "@openstatus/db/src/schema/constants";
import {
  sendAlert as sendOpsGenieAlert,
  sendDegraded as sendOpsGenieDegraded,
  sendRecovery as sendOpsGenieRecovery,
} from "@openstatus/notification-opsgenie";


import {
  sendAlert as sendWebhookAlert,
  sendDegraded as sendWebhookDegraded,
  sendRecovery as sendWebhookRecovery,
} from "@openstatus/notification-webhook";

type SendNotification = ({
  monitor,
  notification,
  statusCode,
  message,
  incidentId,
  cronTimestamp,
  latency,
  region,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incidentId?: string;
  cronTimestamp: number;
  latency?: number;
  region?: Region;
}) => Promise<void>;

type Notif = {
  sendAlert: SendNotification;
  sendRecovery: SendNotification;
  sendDegraded: SendNotification;
};

export const providerToFunction = {
  discord: {
    sendAlert: sendDiscordAlert,
    sendRecovery: sendDiscordRecovery,
    sendDegraded: sendDiscordDegraded,
  },
  email: {
    sendAlert: sendEmailAlert,
    sendRecovery: sendEmailRecovery,
    sendDegraded: sendEmailDegraded,
  },
  ntfy: {
    sendAlert: sendNtfyAlert,
    sendRecovery: sendNtfyRecovery,
    sendDegraded: sendNtfyDegraded,
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
  slack: {
    sendAlert: sendSlackAlert,
    sendRecovery: sendSlackRecovery,
    sendDegraded: sendSlackDegraded,
  },
  sms: {
    sendAlert: sendSmsAlert,
    sendRecovery: sendSmsRecovery,
    sendDegraded: sendSmsDegraded,
  },
  webhook: {
    sendAlert: sendWebhookAlert,
    sendRecovery: sendWebhookRecovery,
    sendDegraded: sendWebhookDegraded,
  },
} satisfies Record<NotificationProvider, Notif>;
