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
  createSubscription,
  upsertEmailSubscription,
  hasPendingUnexpiredSubscription,
  verifySubscription,
  getSubscriptionByToken,
  sendTestWebhook,
  updateChannel,
  updateSubscriptionScope,
  unsubscribe,
} from "./service";
export type {
  CreateSubscriptionInput,
  UpdateChannelInput,
} from "./service";

// Export types
export type { Subscription, PageUpdate, SubscriptionChannel } from "./types";
