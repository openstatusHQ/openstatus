import {
  type NotificationData,
  NotificationProvider,
  OpsgenieRegion,
} from "@openstatus/proto/notification/v1";
import { sendTestDiscordMessage } from "@openstatus/notification-discord";
import { sendTest as sendGoogleChatTest } from "@openstatus/notification-google-chat";
import { sendTest as sendGrafanaTest } from "@openstatus/notification-grafana-oncall";
import { sendTest as sendNtfyTest } from "@openstatus/notification-ntfy";
import { sendTest as sendOpsgenieTest } from "@openstatus/notification-opsgenie";
import { sendTest as sendPagerDutyTest } from "@openstatus/notification-pagerduty";
import { sendTestSlackMessage } from "@openstatus/notification-slack";
import { sendTest as sendTelegramTest } from "@openstatus/notification-telegram";
import { sendTest as sendWhatsAppTest } from "@openstatus/notification-twillio-whatsapp";
import { sendTest as sendWebhookTest } from "@openstatus/notification-webhook";
import {
  invalidNotificationDataError,
  providerNotSupportedError,
  testNotificationFailedError,
} from "./errors";

/**
 * Sends a test notification using the specified provider and data.
 * Throws an error if the provider is not supported or if sending fails.
 */
export async function sendTestNotification(
  provider: NotificationProvider,
  data: NotificationData | undefined,
): Promise<{ success: boolean; errorMessage?: string }> {
  if (!data || data.data.case === undefined) {
    throw invalidNotificationDataError("No provider data specified");
  }

  try {
    switch (provider) {
      case NotificationProvider.TELEGRAM: {
        if (data.data.case !== "telegram") {
          throw invalidNotificationDataError(
            "Expected telegram data for Telegram provider",
          );
        }
        await sendTelegramTest({ chatId: data.data.value.chatId });
        return { success: true };
      }

      case NotificationProvider.WHATSAPP: {
        if (data.data.case !== "whatsapp") {
          throw invalidNotificationDataError(
            "Expected whatsapp data for WhatsApp provider",
          );
        }
        await sendWhatsAppTest({ phoneNumber: data.data.value.phoneNumber });
        return { success: true };
      }

      case NotificationProvider.GOOGLE_CHAT: {
        if (data.data.case !== "googleChat") {
          throw invalidNotificationDataError(
            "Expected google_chat data for Google Chat provider",
          );
        }
        await sendGoogleChatTest(data.data.value.webhookUrl);
        return { success: true };
      }

      case NotificationProvider.GRAFANA_ONCALL: {
        if (data.data.case !== "grafanaOncall") {
          throw invalidNotificationDataError(
            "Expected grafana_oncall data for Grafana OnCall provider",
          );
        }
        await sendGrafanaTest({ webhookUrl: data.data.value.webhookUrl });
        return { success: true };
      }

      case NotificationProvider.DISCORD: {
        if (data.data.case !== "discord") {
          throw invalidNotificationDataError(
            "Expected discord data for Discord provider",
          );
        }
        await sendTestDiscordMessage(data.data.value.webhookUrl);
        return { success: true };
      }

      case NotificationProvider.SLACK: {
        if (data.data.case !== "slack") {
          throw invalidNotificationDataError(
            "Expected slack data for Slack provider",
          );
        }
        await sendTestSlackMessage(data.data.value.webhookUrl);
        return { success: true };
      }

      case NotificationProvider.NTFY: {
        if (data.data.case !== "ntfy") {
          throw invalidNotificationDataError(
            "Expected ntfy data for Ntfy provider",
          );
        }
        await sendNtfyTest({
          topic: data.data.value.topic,
          serverUrl: data.data.value.serverUrl || undefined,
          token: data.data.value.token,
        });
        return { success: true };
      }

      case NotificationProvider.PAGERDUTY: {
        if (data.data.case !== "pagerduty") {
          throw invalidNotificationDataError(
            "Expected pagerduty data for PagerDuty provider",
          );
        }
        await sendPagerDutyTest({
          integrationKey: data.data.value.integrationKey,
        });
        return { success: true };
      }

      case NotificationProvider.OPSGENIE: {
        if (data.data.case !== "opsgenie") {
          throw invalidNotificationDataError(
            "Expected opsgenie data for Opsgenie provider",
          );
        }
        await sendOpsgenieTest({
          apiKey: data.data.value.apiKey,
          region: data.data.value.region === OpsgenieRegion.EU ? "eu" : "us",
        });
        return { success: true };
      }

      case NotificationProvider.WEBHOOK: {
        if (data.data.case !== "webhook") {
          throw invalidNotificationDataError(
            "Expected webhook data for Webhook provider",
          );
        }
        await sendWebhookTest({
          url: data.data.value.endpoint,
          headers: data.data.value.headers?.map((h) => ({
            key: h.key,
            value: h.value,
          })),
        });
        return { success: true };
      }

      // Providers that don't support test notifications yet
      case NotificationProvider.EMAIL:
      case NotificationProvider.SMS:
        throw providerNotSupportedError(NotificationProvider[provider]);

      default:
        throw providerNotSupportedError("Unknown");
    }
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      // Re-throw ConnectErrors as-is
      throw error;
    }
    // Wrap other errors
    const message = error instanceof Error ? error.message : "Unknown error";
    throw testNotificationFailedError(message);
  }
}
