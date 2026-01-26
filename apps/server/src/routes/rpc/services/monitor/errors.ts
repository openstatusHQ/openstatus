import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Error reasons for structured error handling.
 */
export const ErrorReason = {
  MONITOR_NOT_FOUND: "MONITOR_NOT_FOUND",
  MONITOR_REQUIRED: "MONITOR_REQUIRED",
  MONITOR_CREATE_FAILED: "MONITOR_CREATE_FAILED",
  MONITOR_PARSE_FAILED: "MONITOR_PARSE_FAILED",
  MONITOR_RUN_CREATE_FAILED: "MONITOR_RUN_CREATE_FAILED",
  MONITOR_INVALID_DATA: "MONITOR_INVALID_DATA",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;

export type ErrorReason = (typeof ErrorReason)[keyof typeof ErrorReason];

const DOMAIN = "openstatus.dev";

/**
 * Creates a ConnectError with structured metadata.
 *
 * This provides machine-parseable error information via metadata headers
 * while maintaining human-readable error messages.
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
 * Creates a "monitor not found" error with the monitor ID in metadata.
 */
export function monitorNotFoundError(monitorId: string): ConnectError {
  return createError(
    "Monitor not found",
    Code.NotFound,
    ErrorReason.MONITOR_NOT_FOUND,
    { "monitor-id": monitorId },
  );
}

/**
 * Creates a "monitor required" error.
 */
export function monitorRequiredError(): ConnectError {
  return createError(
    "Monitor is required",
    Code.InvalidArgument,
    ErrorReason.MONITOR_REQUIRED,
  );
}

/**
 * Creates a "failed to create monitor" error.
 */
export function monitorCreateFailedError(): ConnectError {
  return createError(
    "Failed to create monitor",
    Code.Internal,
    ErrorReason.MONITOR_CREATE_FAILED,
  );
}

/**
 * Creates a "failed to parse monitor data" error.
 */
export function monitorParseFailedError(monitorId?: string): ConnectError {
  return createError(
    "Failed to parse monitor data",
    Code.Internal,
    ErrorReason.MONITOR_PARSE_FAILED,
    monitorId ? { "monitor-id": monitorId } : undefined,
  );
}

/**
 * Creates a "failed to create monitor run" error.
 */
export function monitorRunCreateFailedError(monitorId: string): ConnectError {
  return createError(
    "Failed to create monitor run",
    Code.Internal,
    ErrorReason.MONITOR_RUN_CREATE_FAILED,
    { "monitor-id": monitorId },
  );
}

/**
 * Creates an "invalid monitor data" error for corrupted data.
 */
export function monitorInvalidDataError(monitorId: string): ConnectError {
  return createError(
    "Invalid monitor data, please contact support",
    Code.Internal,
    ErrorReason.MONITOR_INVALID_DATA,
    { "monitor-id": monitorId },
  );
}

/**
 * Creates a rate limit exceeded error.
 */
export function rateLimitExceededError(
  limit: number,
  current: number,
): ConnectError {
  return createError(
    "Upgrade for more checks",
    Code.ResourceExhausted,
    ErrorReason.RATE_LIMIT_EXCEEDED,
    { limit: String(limit), current: String(current) },
  );
}
