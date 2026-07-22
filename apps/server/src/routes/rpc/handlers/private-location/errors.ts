import { Code, ConnectError } from "@connectrpc/connect";

export const ErrorReason = {
  PRIVATE_LOCATION_NOT_FOUND: "PRIVATE_LOCATION_NOT_FOUND",
  PRIVATE_LOCATION_ID_REQUIRED: "PRIVATE_LOCATION_ID_REQUIRED",
  INVALID_MONITOR_ID: "INVALID_MONITOR_ID",
} as const;

export type ErrorReason = (typeof ErrorReason)[keyof typeof ErrorReason];

const DOMAIN = "openstatus.dev";

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

export function privateLocationNotFoundError(
  privateLocationId: string,
): ConnectError {
  return createError(
    "Private location not found",
    Code.NotFound,
    ErrorReason.PRIVATE_LOCATION_NOT_FOUND,
    { "private-location-id": privateLocationId },
  );
}

export function privateLocationIdRequiredError(): ConnectError {
  return createError(
    "Private location ID is required",
    Code.InvalidArgument,
    ErrorReason.PRIVATE_LOCATION_ID_REQUIRED,
  );
}

export function invalidMonitorIdError(monitorId: string): ConnectError {
  return createError(
    `Invalid monitor id: "${monitorId}"`,
    Code.InvalidArgument,
    ErrorReason.INVALID_MONITOR_ID,
    { "monitor-id": monitorId },
  );
}
