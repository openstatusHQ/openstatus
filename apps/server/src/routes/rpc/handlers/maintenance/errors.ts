import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Error reasons for structured error handling.
 */
export const ErrorReason = {
  MAINTENANCE_NOT_FOUND: "MAINTENANCE_NOT_FOUND",
  MAINTENANCE_ID_REQUIRED: "MAINTENANCE_ID_REQUIRED",
  MAINTENANCE_CREATE_FAILED: "MAINTENANCE_CREATE_FAILED",
  MAINTENANCE_UPDATE_FAILED: "MAINTENANCE_UPDATE_FAILED",
  PAGE_COMPONENT_NOT_FOUND: "PAGE_COMPONENT_NOT_FOUND",
  PAGE_COMPONENTS_MIXED_PAGES: "PAGE_COMPONENTS_MIXED_PAGES",
  PAGE_ID_COMPONENT_MISMATCH: "PAGE_ID_COMPONENT_MISMATCH",
  PAGE_NOT_FOUND: "PAGE_NOT_FOUND",
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
 * Creates a "page not found" error.
 */
export function pageNotFoundError(pageId: string): ConnectError {
  return createError(
    "Page not found",
    Code.NotFound,
    ErrorReason.PAGE_NOT_FOUND,
    {
      "page-id": pageId,
    },
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
