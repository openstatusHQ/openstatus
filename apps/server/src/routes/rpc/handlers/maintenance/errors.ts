import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Error reasons for structured error handling.
 */
export const ErrorReason = {
  MAINTENANCE_NOT_FOUND: "MAINTENANCE_NOT_FOUND",
  MAINTENANCE_ID_REQUIRED: "MAINTENANCE_ID_REQUIRED",
  MAINTENANCE_CREATE_FAILED: "MAINTENANCE_CREATE_FAILED",
  MAINTENANCE_UPDATE_FAILED: "MAINTENANCE_UPDATE_FAILED",
  INVALID_DATE_FORMAT: "INVALID_DATE_FORMAT",
  INVALID_DATE_RANGE: "INVALID_DATE_RANGE",
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
 * Creates a "maintenance not found" error.
 */
export function maintenanceNotFoundError(maintenanceId: string): ConnectError {
  return createError(
    "Maintenance not found",
    Code.NotFound,
    ErrorReason.MAINTENANCE_NOT_FOUND,
    { "maintenance-id": maintenanceId },
  );
}

/**
 * Creates a "maintenance ID required" error.
 */
export function maintenanceIdRequiredError(): ConnectError {
  return createError(
    "Maintenance ID is required",
    Code.InvalidArgument,
    ErrorReason.MAINTENANCE_ID_REQUIRED,
  );
}

/**
 * Creates a "failed to create maintenance" error.
 */
export function maintenanceCreateFailedError(): ConnectError {
  return createError(
    "Failed to create maintenance",
    Code.Internal,
    ErrorReason.MAINTENANCE_CREATE_FAILED,
  );
}

/**
 * Creates a "failed to update maintenance" error.
 */
export function maintenanceUpdateFailedError(
  maintenanceId: string,
): ConnectError {
  return createError(
    "Failed to update maintenance",
    Code.Internal,
    ErrorReason.MAINTENANCE_UPDATE_FAILED,
    { "maintenance-id": maintenanceId },
  );
}

/**
 * Creates an "invalid date format" error.
 */
export function invalidDateFormatError(dateValue: string): ConnectError {
  return createError(
    "Invalid date format. Expected RFC 3339 format (e.g., 2024-01-15T10:30:00Z)",
    Code.InvalidArgument,
    ErrorReason.INVALID_DATE_FORMAT,
    { "date-value": dateValue },
  );
}

/**
 * Creates an "invalid date range" error (from must be before to).
 */
export function invalidDateRangeError(from: string, to: string): ConnectError {
  return createError(
    "Invalid date range. Start time (from) must be before end time (to)",
    Code.InvalidArgument,
    ErrorReason.INVALID_DATE_RANGE,
    { from, to },
  );
}
