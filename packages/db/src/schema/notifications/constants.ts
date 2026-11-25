export const notificationProvider = [
  "discord",
  "email",
  "google-chat",
  "grafana-oncall",
  "ms-teams",
  "ntfy",
  "pagerduty",
  "opsgenie",
  "slack",
  "sms",
  "telegram",
  "webhook",
  "whatsapp",
] as const;

/**
 * ntfy message priorities, lowest to highest. The names are the ones ntfy
 * accepts in its `Priority` header; their 1-based index is ntfy's number.
 */
export const ntfyPriority = [
  "min",
  "low",
  "default",
  "high",
  "urgent",
] as const;
