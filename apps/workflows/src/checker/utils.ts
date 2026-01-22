import type {
  Incident,
  Monitor,
  Notification,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/db/src/schema/constants";
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
  sendAlert as sendGoogleChatAlert,
  sendDegraded as sendGoogleChatDegraded,
  sendRecovery as sendGoogleChatRecovery,
} from "@openstatus/notification-google-chat";
import {
  sendAlert as sendNtfyAlert,
  sendDegraded as sendNtfyDegraded,
  sendRecovery as sendNtfyRecovery,
} from "@openstatus/notification-ntfy";
import {
  sendAlert as sendOpsGenieAlert,
  sendDegraded as sendOpsGenieDegraded,
  sendRecovery as sendOpsGenieRecovery,
} from "@openstatus/notification-opsgenie";
import {
  sendDegraded as sendPagerDutyDegraded,
  sendRecovery as sendPagerDutyRecovery,
  sendAlert as sendPagerdutyAlert,
} from "@openstatus/notification-pagerduty";
import {
  sendAlert as sendSlackAlert,
  sendDegraded as sendSlackDegraded,
  sendRecovery as sendSlackRecovery,
} from "@openstatus/notification-slack";
import {
  sendAlert as sendTelegramAlert,
  sendDegraded as sendTelegramDegraded,
  sendRecovery as sendTelegramRecovery,
} from "@openstatus/notification-telegram";
import {
  sendAlert as sendSmsAlert,
  sendDegraded as sendSmsDegraded,
  sendRecovery as sendSmsRecovery,
} from "@openstatus/notification-twillio-sms";
import {
  sendAlert as sendWhatsappAlert,
  sendDegraded as sendWhatsappDegraded,
  sendRecovery as sendWhatsappRecovery,
} from "@openstatus/notification-twillio-whatsapp";
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
  incident,
  cronTimestamp,
  latency,
  region,
}: {
  monitor: Monitor;
  notification: Notification;
  statusCode?: number;
  message?: string;
  incident?: Incident;
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
  "google-chat": {
    sendAlert: sendGoogleChatAlert,
    sendRecovery: sendGoogleChatRecovery,
    sendDegraded: sendGoogleChatDegraded,
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
  whatsapp: {
    sendAlert: sendWhatsappAlert,
    sendRecovery: sendWhatsappRecovery,
    sendDegraded: sendWhatsappDegraded,
  },
  telegram: {
    sendAlert: sendTelegramAlert,
    sendRecovery: sendTelegramRecovery,
    sendDegraded: sendTelegramDegraded,
  },
} satisfies Record<NotificationProvider, Notif>;
