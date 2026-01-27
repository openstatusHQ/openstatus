import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Error reasons for structured error handling.
 */
export const ErrorReason = {
  STATUS_REPORT_NOT_FOUND: "STATUS_REPORT_NOT_FOUND",
  STATUS_REPORT_ID_REQUIRED: "STATUS_REPORT_ID_REQUIRED",
  STATUS_REPORT_CREATE_FAILED: "STATUS_REPORT_CREATE_FAILED",
  STATUS_REPORT_UPDATE_FAILED: "STATUS_REPORT_UPDATE_FAILED",
  PAGE_COMPONENT_NOT_FOUND: "PAGE_COMPONENT_NOT_FOUND",
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
 * Creates a "status report not found" error.
 */
export function statusReportNotFoundError(
  statusReportId: string,
): ConnectError {
  return createError(
    "Status report not found",
    Code.NotFound,
    ErrorReason.STATUS_REPORT_NOT_FOUND,
    { "status-report-id": statusReportId },
  );
}

/**
 * Creates a "status report ID required" error.
 */
export function statusReportIdRequiredError(): ConnectError {
  return createError(
    "Status report ID is required",
    Code.InvalidArgument,
    ErrorReason.STATUS_REPORT_ID_REQUIRED,
  );
}

/**
 * Creates a "failed to create status report" error.
 */
export function statusReportCreateFailedError(): ConnectError {
  return createError(
    "Failed to create status report",
    Code.Internal,
    ErrorReason.STATUS_REPORT_CREATE_FAILED,
  );
}

/**
 * Creates a "failed to update status report" error.
 */
export function statusReportUpdateFailedError(
  statusReportId: string,
): ConnectError {
  return createError(
    "Failed to update status report",
    Code.Internal,
    ErrorReason.STATUS_REPORT_UPDATE_FAILED,
    { "status-report-id": statusReportId },
  );
}

/**
 * Creates a "page component not found" error.
 */
export function pageComponentNotFoundError(
  pageComponentId: string,
): ConnectError {
  return createError(
    "Page component not found",
    Code.NotFound,
    ErrorReason.PAGE_COMPONENT_NOT_FOUND,
    { "page-component-id": pageComponentId },
  );
}
