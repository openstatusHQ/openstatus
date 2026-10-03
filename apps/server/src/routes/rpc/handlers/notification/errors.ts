import { Code, type ConnectError } from "@connectrpc/connect";

import {
  ErrorReason,
  idRequiredError,
  monitorNotFoundError as sharedMonitorNotFoundError,
  planFeatureNotAvailableError,
  planLimitReachedError,
  rpcError,
} from "../../errors";

export function notificationIdRequiredError(): ConnectError {
  return idRequiredError("Notification");
}

export function notificationLimitReachedError(max: number): ConnectError {
  return planLimitReachedError(
    "You have reached your notification channel limit. Upgrade to add more.",
    "notification-channels",
    max,
  );
}

export function providerNotAllowedError(provider: string): ConnectError {
  return planFeatureNotAvailableError(
    `The ${provider} provider requires an upgraded plan.`,
    "notification-provider",
    { provider },
  );
}

export function providerNotSupportedError(provider: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.PROVIDER_NOT_SUPPORTED,
    message: `The provider ${provider} is not supported for test notifications.`,
    metadata: { provider },
  });
}

export function invalidNotificationDataError(details: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.INVALID_NOTIFICATION_DATA,
    message: `Invalid notification data: ${details}`,
  });
}

export function monitorNotFoundError(monitorId: string): ConnectError {
  return sharedMonitorNotFoundError(
    monitorId,
    "Monitor not found or not accessible",
  );
}

export function testNotificationFailedError(message: string): ConnectError {
  return rpcError({
    code: Code.Internal,
    reason: ErrorReason.TEST_NOTIFICATION_FAILED,
    message: `Test notification failed: ${message}`,
  });
}
