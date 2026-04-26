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

// Subscription CRUD lives in `@openstatus/services/page-subscriber` —
// this package now only ships the channel + dispatcher primitives that
// the service layer composes on top of.

// Export types
export type { Subscription, PageUpdate, SubscriptionChannel } from "./types";
