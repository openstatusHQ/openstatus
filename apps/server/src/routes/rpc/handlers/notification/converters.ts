import { create } from "@bufbuild/protobuf";
import type { NotificationProvider as DBNotificationProvider } from "@openstatus/db/src/schema";
import type {
  Notification,
  NotificationData,
  NotificationSummary,
} from "@openstatus/proto/notification/v1";
import {
  NotificationDataSchema,
  NotificationProvider,
  NotificationSchema,
  NotificationSummarySchema,
  OpsgenieRegion,
} from "@openstatus/proto/notification/v1";

type DBNotification = {
  id: number;
  name: string;
  provider: DBNotificationProvider;
  data: string | null;
  workspaceId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/**
 * Maps DB provider string to proto NotificationProvider enum.
 */
export function dbProviderToProto(
  provider: DBNotificationProvider,
): NotificationProvider {
  const mapping: Record<DBNotificationProvider, NotificationProvider> = {
    discord: NotificationProvider.DISCORD,
    email: NotificationProvider.EMAIL,
    "google-chat": NotificationProvider.GOOGLE_CHAT,
    "grafana-oncall": NotificationProvider.GRAFANA_ONCALL,
    ntfy: NotificationProvider.NTFY,
    pagerduty: NotificationProvider.PAGERDUTY,
    opsgenie: NotificationProvider.OPSGENIE,
    slack: NotificationProvider.SLACK,
    sms: NotificationProvider.SMS,
    telegram: NotificationProvider.TELEGRAM,
    webhook: NotificationProvider.WEBHOOK,
    whatsapp: NotificationProvider.WHATSAPP,
  };
  return mapping[provider] ?? NotificationProvider.UNSPECIFIED;
}

/**
 * Maps NotificationProvider to expected NotificationData case.
 */
export function getExpectedDataCase(
  provider: NotificationProvider,
): string | undefined {
  const mapping: Record<number, string> = {
    [NotificationProvider.DISCORD]: "discord",
    [NotificationProvider.EMAIL]: "email",
    [NotificationProvider.GOOGLE_CHAT]: "googleChat",
    [NotificationProvider.GRAFANA_ONCALL]: "grafanaOncall",
    [NotificationProvider.NTFY]: "ntfy",
    [NotificationProvider.PAGERDUTY]: "pagerduty",
    [NotificationProvider.OPSGENIE]: "opsgenie",
    [NotificationProvider.SLACK]: "slack",
    [NotificationProvider.SMS]: "sms",
    [NotificationProvider.TELEGRAM]: "telegram",
    [NotificationProvider.WEBHOOK]: "webhook",
    [NotificationProvider.WHATSAPP]: "whatsapp",
  };
  return mapping[provider];
}

/**
 * Validates that the notification data matches the provider.
 * Returns an error message if validation fails, undefined if valid.
 */
export function validateProviderDataConsistency(
  provider: NotificationProvider,
  data: NotificationData | undefined,
): string | undefined {
  if (provider === NotificationProvider.UNSPECIFIED) {
    return "Provider must be specified";
  }

  const expectedCase = getExpectedDataCase(provider);
  if (!expectedCase) {
    return `Unknown provider: ${provider}`;
  }

  if (!data || data.data.case === undefined) {
    return `Provider ${NotificationProvider[provider]} requires ${expectedCase} data, but no data was provided`;
  }

  const actualCase = data.data.case;
  if (actualCase !== expectedCase) {
    return `Provider ${NotificationProvider[provider]} requires ${expectedCase} data, got ${actualCase}`;
  }

  return undefined;
}

/**
 * Maps proto NotificationProvider enum to DB provider string.
 */
export function protoProviderToDb(
  provider: NotificationProvider,
): DBNotificationProvider {
  const mapping: Record<number, DBNotificationProvider> = {
    [NotificationProvider.DISCORD]: "discord",
    [NotificationProvider.EMAIL]: "email",
    [NotificationProvider.GOOGLE_CHAT]: "google-chat",
    [NotificationProvider.GRAFANA_ONCALL]: "grafana-oncall",
    [NotificationProvider.NTFY]: "ntfy",
    [NotificationProvider.PAGERDUTY]: "pagerduty",
    [NotificationProvider.OPSGENIE]: "opsgenie",
    [NotificationProvider.SLACK]: "slack",
    [NotificationProvider.SMS]: "sms",
    [NotificationProvider.TELEGRAM]: "telegram",
    [NotificationProvider.WEBHOOK]: "webhook",
    [NotificationProvider.WHATSAPP]: "whatsapp",
  };
  return mapping[provider] ?? "email";
}

/**
 * Parses DB JSON data string to proto NotificationData.
 */
export function dbDataToProto(
  provider: DBNotificationProvider,
  dataStr: string | null,
): NotificationData | undefined {
  if (!dataStr) {
    return undefined;
  }

  try {
    const data = JSON.parse(dataStr);
    const protoData = create(NotificationDataSchema);

    switch (provider) {
      case "discord":
        if (data.discord) {
          protoData.data = {
            case: "discord",
            value: {
              $typeName: "openstatus.notification.v1.DiscordData",
              webhookUrl: data.discord,
            },
          };
        }
        break;
      case "email":
        if (data.email) {
          protoData.data = {
            case: "email",
            value: {
              $typeName: "openstatus.notification.v1.EmailData",
              email: data.email,
            },
          };
        }
        break;
      case "google-chat":
        if (data["google-chat"]) {
          protoData.data = {
            case: "googleChat",
            value: {
              $typeName: "openstatus.notification.v1.GoogleChatData",
              webhookUrl: data["google-chat"],
            },
          };
        }
        break;
      case "grafana-oncall":
        if (data["grafana-oncall"]) {
          protoData.data = {
            case: "grafanaOncall",
            value: {
              $typeName: "openstatus.notification.v1.GrafanaOncallData",
              webhookUrl: data["grafana-oncall"].webhookUrl,
            },
          };
        }
        break;
      case "ntfy":
        if (data.ntfy) {
          protoData.data = {
            case: "ntfy",
            value: {
              $typeName: "openstatus.notification.v1.NtfyData",
              topic: data.ntfy.topic || "",
              serverUrl: data.ntfy.serverUrl || "https://ntfy.sh",
              token: data.ntfy.token,
            },
          };
        }
        break;
      case "pagerduty":
        if (data.pagerduty) {
          protoData.data = {
            case: "pagerduty",
            value: {
              $typeName: "openstatus.notification.v1.PagerDutyData",
              integrationKey: data.pagerduty,
            },
          };
        }
        break;
      case "opsgenie":
        if (data.opsgenie) {
          protoData.data = {
            case: "opsgenie",
            value: {
              $typeName: "openstatus.notification.v1.OpsgenieData",
              apiKey: data.opsgenie.apiKey,
              region:
                data.opsgenie.region === "eu"
                  ? OpsgenieRegion.EU
                  : OpsgenieRegion.US,
            },
          };
        }
        break;
      case "slack":
        if (data.slack) {
          protoData.data = {
            case: "slack",
            value: {
              $typeName: "openstatus.notification.v1.SlackData",
              webhookUrl: data.slack,
            },
          };
        }
        break;
      case "sms":
        if (data.sms) {
          protoData.data = {
            case: "sms",
            value: {
              $typeName: "openstatus.notification.v1.SmsData",
              phoneNumber: data.sms,
            },
          };
        }
        break;
      case "telegram":
        if (data.telegram) {
          protoData.data = {
            case: "telegram",
            value: {
              $typeName: "openstatus.notification.v1.TelegramData",
              chatId: data.telegram.chatId,
            },
          };
        }
        break;
      case "webhook":
        if (data.webhook) {
          protoData.data = {
            case: "webhook",
            value: {
              $typeName: "openstatus.notification.v1.WebhookData",
              endpoint: data.webhook.endpoint,
              headers:
                data.webhook.headers?.map(
                  (h: { key: string; value: string }) => ({
                    $typeName: "openstatus.notification.v1.WebhookHeader",
                    key: h.key,
                    value: h.value,
                  }),
                ) ?? [],
            },
          };
        }
        break;
      case "whatsapp":
        if (data.whatsapp) {
          protoData.data = {
            case: "whatsapp",
            value: {
              $typeName: "openstatus.notification.v1.WhatsappData",
              phoneNumber: data.whatsapp,
            },
          };
        }
        break;
    }

    return protoData;
  } catch (error) {
    console.error("Failed to parse notification data:", {
      provider,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return undefined;
  }
}

/**
 * Converts proto NotificationData to DB JSON string format.
 */
export function protoDataToDb(
  _provider: NotificationProvider,
  data: NotificationData | undefined,
): string {
  if (!data || data.data.case === undefined) {
    return "{}";
  }

  switch (data.data.case) {
    case "discord":
      return JSON.stringify({ discord: data.data.value.webhookUrl });
    case "email":
      return JSON.stringify({ email: data.data.value.email });
    case "googleChat":
      return JSON.stringify({ "google-chat": data.data.value.webhookUrl });
    case "grafanaOncall":
      return JSON.stringify({
        "grafana-oncall": { webhookUrl: data.data.value.webhookUrl },
      });
    case "ntfy":
      return JSON.stringify({
        ntfy: {
          topic: data.data.value.topic,
          serverUrl: data.data.value.serverUrl,
          token: data.data.value.token,
        },
      });
    case "pagerduty":
      return JSON.stringify({ pagerduty: data.data.value.integrationKey });
    case "opsgenie":
      return JSON.stringify({
        opsgenie: {
          apiKey: data.data.value.apiKey,
          region: data.data.value.region === OpsgenieRegion.EU ? "eu" : "us",
        },
      });
    case "slack":
      return JSON.stringify({ slack: data.data.value.webhookUrl });
    case "sms":
      return JSON.stringify({ sms: data.data.value.phoneNumber });
    case "telegram":
      return JSON.stringify({
        telegram: { chatId: data.data.value.chatId },
      });
    case "webhook":
      return JSON.stringify({
        webhook: {
          endpoint: data.data.value.endpoint,
          headers: data.data.value.headers?.map((h) => ({
            key: h.key,
            value: h.value,
          })),
        },
      });
    case "whatsapp":
      return JSON.stringify({ whatsapp: data.data.value.phoneNumber });
    default:
      return "{}";
  }
}

/**
 * Converts a DB notification to proto Notification format.
 */
export function dbNotificationToProto(
  notification: DBNotification,
  monitorIds: string[],
): Notification {
  return create(NotificationSchema, {
    id: String(notification.id),
    name: notification.name,
    provider: dbProviderToProto(notification.provider),
    data: dbDataToProto(notification.provider, notification.data),
    monitorIds,
    createdAt: notification.createdAt?.toISOString() ?? "",
    updatedAt: notification.updatedAt?.toISOString() ?? "",
  });
}

/**
 * Converts a DB notification to proto NotificationSummary format.
 */
export function dbNotificationToProtoSummary(
  notification: DBNotification,
  monitorCount: number,
): NotificationSummary {
  return create(NotificationSummarySchema, {
    id: String(notification.id),
    name: notification.name,
    provider: dbProviderToProto(notification.provider),
    monitorCount,
    createdAt: notification.createdAt?.toISOString() ?? "",
    updatedAt: notification.updatedAt?.toISOString() ?? "",
  });
}
