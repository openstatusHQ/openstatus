// Export channel functions
export {
  sendEmailNotifications,
  sendEmailVerification,
  validateEmailConfig,
} from "./channels/email";
export {
  buildTestPayload,
  detectWebhookFlavor,
  sendTestWebhookRequest,
  sendWebhookNotifications,
  sendWebhookVerification,
  validateWebhookConfig,
} from "./channels/webhook";
export type { WebhookFlavor } from "./channels/webhook";
export { getChannel } from "./channels/index";

// Export dispatcher functions
export {
  dispatchStatusReportUpdate,
  dispatchMaintenanceUpdate,
  dispatchPageUpdate,
} from "./dispatcher";

// Export service functions
export {
  upsertEmailSubscription,
  hasPendingUnexpiredSubscription,
  verifySubscription,
  getSubscriptionByToken,
  sendTestWebhook,
  updateSubscriptionScope,
  unsubscribe,
} from "./service";

// Export types
export type { Subscription, PageUpdate, SubscriptionChannel } from "./types";
