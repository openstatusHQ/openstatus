// Client-safe entrypoint: re-exports only pure helpers that do not
// transitively load server-only modules (env vars, Resend, DB, etc).
export { detectWebhookFlavor } from "./channels/webhook";
export type { WebhookFlavor } from "./channels/webhook";
