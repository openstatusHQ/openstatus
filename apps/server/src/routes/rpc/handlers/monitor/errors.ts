import { Code, type ConnectError } from "@connectrpc/connect";

import {
  ErrorReason,
  idRequiredError,
  planFeatureNotAvailableError,
  planLimitReachedError,
  rpcError,
} from "../../errors";

export { monitorNotFoundError } from "../../errors";

export function monitorRequiredError(): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.VALIDATION_FAILED,
    message: "Monitor is required",
    fieldViolations: [{ field: "monitor", description: "Monitor is required" }],
  });
}

export function monitorIdRequiredError(): ConnectError {
  return idRequiredError("Monitor");
}

export function monitorIdInvalidError(monitorId: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.INVALID_MONITOR_ID,
    message: `Invalid monitor id: "${monitorId}"`,
    metadata: { monitorId },
  });
}

export function monitorTriggerFailedError(monitorId: string): ConnectError {
  return rpcError({
    code: Code.Unavailable,
    reason: ErrorReason.MONITOR_TRIGGER_FAILED,
    message: "Failed to trigger the monitor in any region",
    metadata: { monitorId },
  });
}

export function monitorTypeMismatchError(
  monitorId: string,
  expectedType: string,
  actualType: string,
): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.MONITOR_TYPE_MISMATCH,
    message: `Monitor type mismatch: expected ${expectedType}, got ${actualType}`,
    metadata: { monitorId, expectedType, actualType },
  });
}

export function responseLogNotFoundError(
  monitorId: string,
  logId: string,
): ConnectError {
  return rpcError({
    code: Code.NotFound,
    reason: ErrorReason.RESPONSE_LOG_NOT_FOUND,
    message: "Response log not found",
    metadata: { monitorId, logId },
  });
}

export function responseLogsNotEnabledError(): ConnectError {
  return planFeatureNotAvailableError(
    "Upgrade for response logs",
    "response-logs",
  );
}

export function monitorParseFailedError(monitorId?: string): ConnectError {
  return rpcError({
    code: Code.Internal,
    reason: ErrorReason.INTERNAL_SERVER_ERROR,
    message: "Failed to parse monitor data",
    metadata: monitorId ? { monitorId } : undefined,
  });
}

export function monitorInvalidDataError(monitorId: string): ConnectError {
  return rpcError({
    code: Code.Internal,
    reason: ErrorReason.INTERNAL_SERVER_ERROR,
    message: "Invalid monitor data, please contact support",
    metadata: { monitorId },
  });
}

export function rateLimitExceededError(
  limit: number,
  current: number,
): ConnectError {
  return planLimitReachedError(
    "Upgrade for more checks",
    "checks",
    limit,
    current,
  );
}
