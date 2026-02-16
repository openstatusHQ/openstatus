import type { SubscriptionChannel } from "../types";
import {
  sendEmailNotifications,
  sendEmailVerification,
  validateEmailConfig,
} from "./email";
import {
  sendWebhookNotifications,
  sendWebhookVerification,
  validateWebhookConfig,
} from "./webhook";

/**
 * Get a channel by type
 *
 * @param channelType - The channel type (email, webhook)
 * @returns The channel functions or null if unknown type
 */
export function getChannel(channelType: string): SubscriptionChannel | null {
  switch (channelType) {
    case "email": {
      return {
        id: "email",
        sendNotifications: sendEmailNotifications,
        sendVerification: sendEmailVerification,
        validateConfig: validateEmailConfig,
      };
    }
    case "webhook": {
      return {
        id: "webhook",
        sendNotifications: sendWebhookNotifications,
        sendVerification: sendWebhookVerification,
        validateConfig: validateWebhookConfig,
      };
    }
    default:
      return null;
  }
}
