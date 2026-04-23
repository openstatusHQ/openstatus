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
  PAGE_COMPONENTS_MIXED_PAGES: "PAGE_COMPONENTS_MIXED_PAGES",
  PAGE_ID_COMPONENT_MISMATCH: "PAGE_ID_COMPONENT_MISMATCH",
  INVALID_DATE_FORMAT: "INVALID_DATE_FORMAT",
  INVALID_STATUS: "INVALID_STATUS",
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

/**
 * Creates a "page components from mixed pages" error.
 */
export function pageComponentsMixedPagesError(): ConnectError {
  return createError(
    "All page components must belong to the same page",
    Code.InvalidArgument,
    ErrorReason.PAGE_COMPONENTS_MIXED_PAGES,
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
 * Creates an "invalid status" error.
 */
export function invalidStatusError(statusValue: number): ConnectError {
  return createError(
    `Invalid status value: ${statusValue}. Expected INVESTIGATING, IDENTIFIED, MONITORING, or RESOLVED`,
    Code.InvalidArgument,
    ErrorReason.INVALID_STATUS,
    { "status-value": String(statusValue) },
  );
}

/**
 * Creates a "page ID and component page mismatch" error.
 */
export function pageIdComponentMismatchError(
  providedPageId: string,
  componentPageId: string,
): ConnectError {
  return createError(
    `Page ID ${providedPageId} does not match the page ID ${componentPageId} of the provided components`,
    Code.InvalidArgument,
    ErrorReason.PAGE_ID_COMPONENT_MISMATCH,
    {
      "provided-page-id": providedPageId,
      "component-page-id": componentPageId,
    },
  );
}
