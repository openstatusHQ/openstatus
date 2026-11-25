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
export {
  createSlackChannel,
  sendSlackNotifications,
  validateSlackConfig,
} from "./channels/slack";
export type { SlackChannelDeps, SlackClient } from "./channels/slack";
export { buildReplyMessage, buildRootMessage } from "./channels/slack-blocks";
export {
  createMemoryAnchorStore,
  createRedisAnchorStore,
} from "./channels/slack-store";
export type { SlackAnchorStore } from "./channels/slack-store";
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
