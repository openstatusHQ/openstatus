import { Code, type ConnectError } from "@connectrpc/connect";

import { ErrorReason, rpcError } from "@/libs/errors/rpc";

export { ErrorReason, rpcError } from "@/libs/errors/rpc";

/** Factories shared by more than one service; domain-specific ones live next to their handler. */

export function idRequiredError(resource: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.VALIDATION_FAILED,
    message: `${resource} ID is required`,
    fieldViolations: [
      { field: "id", description: `${resource} ID is required` },
    ],
  });
}

export function monitorNotFoundError(
  monitorId: string,
  message = "Monitor not found",
): ConnectError {
  return rpcError({
    code: Code.NotFound,
    reason: ErrorReason.MONITOR_NOT_FOUND,
    message,
    metadata: { monitorId },
  });
}

export function pageComponentNotFoundError(componentId: string): ConnectError {
  return rpcError({
    code: Code.NotFound,
    reason: ErrorReason.PAGE_COMPONENT_NOT_FOUND,
    message: "Page component not found",
    metadata: { pageComponentId: componentId },
  });
}

export function invalidDateFormatError(dateValue: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.INVALID_DATE_FORMAT,
    message:
      "Invalid date format. Expected RFC 3339 format (e.g., 2024-01-15T10:30:00Z)",
    metadata: { value: dateValue },
  });
}

/** Boolean entitlements (`custom-domain`, `sms`, ...): the plan lacks the feature outright. */
export function planFeatureNotAvailableError(
  message: string,
  feature: string,
  metadata?: Record<string, string>,
): ConnectError {
  return rpcError({
    code: Code.PermissionDenied,
    reason: ErrorReason.PLAN_FEATURE_NOT_AVAILABLE,
    message,
    metadata: { feature, ...metadata },
  });
}

/** Row-count caps (`monitors`, `status-pages`, ...): the plan has the feature, the quota is used up. */
export function planLimitReachedError(
  message: string,
  limit: string,
  max: number,
  current?: number,
): ConnectError {
  const metadata: Record<string, string> = { limit, max: String(max) };
  if (current !== undefined) metadata.current = String(current);
  return rpcError({
    code: Code.PermissionDenied,
    reason: ErrorReason.PLAN_LIMIT_REACHED,
    message,
    metadata,
  });
}
