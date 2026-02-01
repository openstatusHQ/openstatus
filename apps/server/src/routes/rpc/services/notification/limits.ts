import { count, db, eq } from "@openstatus/db";
import { notification } from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { NotificationProvider } from "@openstatus/proto/notification/v1";
import {
  notificationLimitReachedError,
  providerNotAllowedError,
} from "./errors";

/**
 * Providers that require a paid plan.
 */
const LIMITED_PROVIDERS = new Set([
  NotificationProvider.SMS,
  NotificationProvider.PAGERDUTY,
  NotificationProvider.OPSGENIE,
  NotificationProvider.GRAFANA_ONCALL,
  NotificationProvider.WHATSAPP,
]);

/**
 * Maps proto provider to the limit key in workspace limits.
 */
function providerToLimitKey(
  provider: NotificationProvider,
): keyof Limits | null {
  switch (provider) {
    case NotificationProvider.SMS:
      return "sms";
    case NotificationProvider.PAGERDUTY:
      return "pagerduty";
    case NotificationProvider.OPSGENIE:
      return "opsgenie";
    case NotificationProvider.GRAFANA_ONCALL:
      return "grafana-oncall";
    case NotificationProvider.WHATSAPP:
      return "whatsapp";
    default:
      return null;
  }
}

/**
 * Maps proto provider to display name for error messages.
 */
function providerToDisplayName(provider: NotificationProvider): string {
  switch (provider) {
    case NotificationProvider.DISCORD:
      return "Discord";
    case NotificationProvider.EMAIL:
      return "Email";
    case NotificationProvider.GOOGLE_CHAT:
      return "Google Chat";
    case NotificationProvider.GRAFANA_ONCALL:
      return "Grafana OnCall";
    case NotificationProvider.NTFY:
      return "Ntfy";
    case NotificationProvider.PAGERDUTY:
      return "PagerDuty";
    case NotificationProvider.OPSGENIE:
      return "Opsgenie";
    case NotificationProvider.SLACK:
      return "Slack";
    case NotificationProvider.SMS:
      return "SMS";
    case NotificationProvider.TELEGRAM:
      return "Telegram";
    case NotificationProvider.WEBHOOK:
      return "Webhook";
    case NotificationProvider.WHATSAPP:
      return "WhatsApp";
    default:
      return "Unknown";
  }
}

/**
 * Checks if the workspace has reached its notification limit.
 * Throws notificationLimitReachedError if limit is reached.
 */
export async function checkNotificationLimit(
  workspaceId: number,
  limits: Limits,
): Promise<void> {
  const maxCount = limits["notification-channels"];

  const result = await db
    .select({ count: count() })
    .from(notification)
    .where(eq(notification.workspaceId, workspaceId))
    .get();

  const currentCount = result?.count ?? 0;

  if (currentCount >= maxCount) {
    throw notificationLimitReachedError();
  }
}

/**
 * Checks if the provider is allowed for the workspace's plan.
 * Throws providerNotAllowedError if not allowed.
 */
export function checkProviderAllowed(
  provider: NotificationProvider,
  limits: Limits,
): void {
  if (!LIMITED_PROVIDERS.has(provider)) {
    return; // Provider is free for all plans
  }

  const limitKey = providerToLimitKey(provider);
  if (!limitKey) {
    return; // No limit key means it's free
  }

  const isAllowed = limits[limitKey];
  if (!isAllowed) {
    throw providerNotAllowedError(providerToDisplayName(provider));
  }
}

/**
 * Gets the current notification count and limit for a workspace.
 */
export async function getNotificationLimitInfo(
  workspaceId: number,
  limits: Limits,
): Promise<{ currentCount: number; maxCount: number; limitReached: boolean }> {
  const maxCount = limits["notification-channels"];

  const result = await db
    .select({ count: count() })
    .from(notification)
    .where(eq(notification.workspaceId, workspaceId))
    .get();

  const currentCount = result?.count ?? 0;

  return {
    currentCount,
    maxCount,
    limitReached: currentCount >= maxCount,
  };
}
