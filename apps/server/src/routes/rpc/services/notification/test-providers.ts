import {
  type NotificationData,
  NotificationProvider,
} from "@openstatus/proto/notification/v1";
import { sendTest as sendGoogleChatTest } from "@openstatus/notification-google-chat";
import { sendTest as sendGrafanaTest } from "@openstatus/notification-grafana-oncall";
import { sendTest as sendTelegramTest } from "@openstatus/notification-telegram";
import { sendTest as sendWhatsAppTest } from "@openstatus/notification-twillio-whatsapp";
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

      // Providers that don't support test notifications yet
      case NotificationProvider.DISCORD:
      case NotificationProvider.EMAIL:
      case NotificationProvider.NTFY:
      case NotificationProvider.PAGERDUTY:
      case NotificationProvider.OPSGENIE:
      case NotificationProvider.SLACK:
      case NotificationProvider.SMS:
      case NotificationProvider.WEBHOOK:
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
