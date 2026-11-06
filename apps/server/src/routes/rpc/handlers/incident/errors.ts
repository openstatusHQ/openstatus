import { Code, type ConnectError } from "@connectrpc/connect";

import { ErrorReason, rpcError } from "../../errors";

export function incidentNotFoundError(incidentId: string): ConnectError {
  return rpcError({
    code: Code.NotFound,
    reason: ErrorReason.INCIDENT_NOT_FOUND,
    message: "Incident not found",
    metadata: { incidentId },
  });
}

export function invalidCommanderError(email: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.VALIDATION_FAILED,
    message: `No workspace member with email "${email}"`,
  });
}

export function conflictingFieldsError(
  value: string,
  clear: string,
): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.VALIDATION_FAILED,
    message: `Set either ${value} or ${clear}, not both`,
  });
}

export function invalidDateFormatError(value: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.INVALID_DATE_FORMAT,
    message: `Invalid date format: "${value}". Expected RFC 3339.`,
    metadata: { value },
  });
}

export function invalidEnumError(field: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.VALIDATION_FAILED,
    message: `Invalid ${field}`,
    fieldViolations: [{ field, description: `Invalid ${field}` }],
  });
}
