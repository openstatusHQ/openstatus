import { Code, ConnectError } from "@connectrpc/connect";

export const ErrorReason = {
  INCIDENT_NOT_FOUND: "INCIDENT_NOT_FOUND",
  INVALID_ID: "INVALID_ID",
  INVALID_COMMANDER: "INVALID_COMMANDER",
  CONFLICTING_FIELDS: "CONFLICTING_FIELDS",
  INVALID_DATE_FORMAT: "INVALID_DATE_FORMAT",
  INVALID_ENUM: "INVALID_ENUM",
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

export function incidentNotFoundError(incidentId: string): ConnectError {
  return createError(
    "Incident not found",
    Code.NotFound,
    ErrorReason.INCIDENT_NOT_FOUND,
    { "incident-id": incidentId },
  );
}

export function invalidIdError(field: string, value: string): ConnectError {
  return createError(
    `Invalid ${field}: "${value}"`,
    Code.InvalidArgument,
    ErrorReason.INVALID_ID,
    { field },
  );
}

export function invalidCommanderError(email: string): ConnectError {
  return createError(
    `No workspace member with email "${email}"`,
    Code.InvalidArgument,
    ErrorReason.INVALID_COMMANDER,
  );
}

export function conflictingFieldsError(
  value: string,
  clear: string,
): ConnectError {
  return createError(
    `Set either ${value} or ${clear}, not both`,
    Code.InvalidArgument,
    ErrorReason.CONFLICTING_FIELDS,
  );
}

export function invalidDateFormatError(value: string): ConnectError {
  return createError(
    `Invalid date format: "${value}". Expected RFC 3339.`,
    Code.InvalidArgument,
    ErrorReason.INVALID_DATE_FORMAT,
  );
}

export function invalidEnumError(field: string): ConnectError {
  return createError(
    `Invalid ${field}`,
    Code.InvalidArgument,
    ErrorReason.INVALID_ENUM,
    { field },
  );
}
