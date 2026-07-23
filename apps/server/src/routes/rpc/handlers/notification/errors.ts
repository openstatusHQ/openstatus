import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Error reasons for structured error handling.
 */
export const ErrorReason = {
  NOTIFICATION_NOT_FOUND: "NOTIFICATION_NOT_FOUND",
  NOTIFICATION_ID_REQUIRED: "NOTIFICATION_ID_REQUIRED",
  NOTIFICATION_CREATE_FAILED: "NOTIFICATION_CREATE_FAILED",
  NOTIFICATION_UPDATE_FAILED: "NOTIFICATION_UPDATE_FAILED",
  NOTIFICATION_LIMIT_REACHED: "NOTIFICATION_LIMIT_REACHED",
  PROVIDER_NOT_ALLOWED: "PROVIDER_NOT_ALLOWED",
  PROVIDER_NOT_SUPPORTED: "PROVIDER_NOT_SUPPORTED",
  INVALID_NOTIFICATION_DATA: "INVALID_NOTIFICATION_DATA",
  MONITOR_NOT_FOUND: "MONITOR_NOT_FOUND",
  TEST_NOTIFICATION_FAILED: "TEST_NOTIFICATION_FAILED",
} as const;

export type ErrorReason = (typeof ErrorReason)[keyof typeof ErrorReason];

const DOMAIN = "openstatus.dev";

/**
 * Creates a ConnectError with structured metadata.
 */
function createError(
  message: string,
  code: Code,
  reason: ErrorReason,
  metadata?: Record<string, string>,
): ConnectError {
  const headers = new Headers({
    "error-domain": DOMAIN,
    "error-reason": reason,
  });

  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      headers.set(`error-${key}`, value);
    }
  }

  return new ConnectError(message, code, headers);
}

/**
 * Creates a "notification not found" error.
 */
export function notificationNotFoundError(
  notificationId: string,
): ConnectError {
  return createError(
    "Notification not found",
    Code.NotFound,
    ErrorReason.NOTIFICATION_NOT_FOUND,
    { "notification-id": notificationId },
  );
}

/**
 * Creates a "notification ID required" error.
 */
export function notificationIdRequiredError(): ConnectError {
  return createError(
    "Notification ID is required",
    Code.InvalidArgument,
    ErrorReason.NOTIFICATION_ID_REQUIRED,
  );
}

/**
 * Creates a "failed to create notification" error.
 */
export function notificationCreateFailedError(): ConnectError {
  return createError(
    "Failed to create notification",
    Code.Internal,
    ErrorReason.NOTIFICATION_CREATE_FAILED,
  );
}

/**
 * Creates a "failed to update notification" error.
 */
export function notificationUpdateFailedError(
  notificationId: string,
): ConnectError {
  return createError(
    "Failed to update notification",
    Code.Internal,
    ErrorReason.NOTIFICATION_UPDATE_FAILED,
    { "notification-id": notificationId },
  );
}

/**
 * Creates a "notification limit reached" error.
 */
export function notificationLimitReachedError(): ConnectError {
  return createError(
    "You have reached your notification channel limit. Upgrade to add more.",
    Code.ResourceExhausted,
    ErrorReason.NOTIFICATION_LIMIT_REACHED,
  );
}

/**
 * Creates a "provider not allowed" error for limited providers.
 */
export function providerNotAllowedError(provider: string): ConnectError {
  return createError(
    `The ${provider} provider requires an upgraded plan.`,
    Code.PermissionDenied,
    ErrorReason.PROVIDER_NOT_ALLOWED,
    { provider },
  );
}

/**
 * Creates a "provider not supported" error.
 */
export function providerNotSupportedError(provider: string): ConnectError {
  return createError(
    `The provider ${provider} is not supported for test notifications.`,
    Code.InvalidArgument,
    ErrorReason.PROVIDER_NOT_SUPPORTED,
    { provider },
  );
}

/**
 * Creates an "invalid notification data" error.
 */
export function invalidNotificationDataError(details: string): ConnectError {
  return createError(
    `Invalid notification data: ${details}`,
    Code.InvalidArgument,
    ErrorReason.INVALID_NOTIFICATION_DATA,
    { details },
  );
}

/**
 * Creates a "monitor not found" error.
 */
export function monitorNotFoundError(monitorId: string): ConnectError {
  return createError(
    "Monitor not found or not accessible",
    Code.NotFound,
    ErrorReason.MONITOR_NOT_FOUND,
    { "monitor-id": monitorId },
  );
}

/**
 * Creates a "test notification failed" error.
 */
export function testNotificationFailedError(message: string): ConnectError {
  return createError(
    `Test notification failed: ${message}`,
    Code.Internal,
    ErrorReason.TEST_NOTIFICATION_FAILED,
    { message },
  );
}
