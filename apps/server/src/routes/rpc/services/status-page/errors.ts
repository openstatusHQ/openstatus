import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Error reasons for structured error handling.
 */
export const ErrorReason = {
  STATUS_PAGE_NOT_FOUND: "STATUS_PAGE_NOT_FOUND",
  STATUS_PAGE_ID_REQUIRED: "STATUS_PAGE_ID_REQUIRED",
  STATUS_PAGE_CREATE_FAILED: "STATUS_PAGE_CREATE_FAILED",
  STATUS_PAGE_UPDATE_FAILED: "STATUS_PAGE_UPDATE_FAILED",
  STATUS_PAGE_NOT_PUBLISHED: "STATUS_PAGE_NOT_PUBLISHED",
  STATUS_PAGE_ACCESS_DENIED: "STATUS_PAGE_ACCESS_DENIED",
  SLUG_ALREADY_EXISTS: "SLUG_ALREADY_EXISTS",
  PAGE_COMPONENT_NOT_FOUND: "PAGE_COMPONENT_NOT_FOUND",
  PAGE_COMPONENT_CREATE_FAILED: "PAGE_COMPONENT_CREATE_FAILED",
  PAGE_COMPONENT_UPDATE_FAILED: "PAGE_COMPONENT_UPDATE_FAILED",
  COMPONENT_GROUP_NOT_FOUND: "COMPONENT_GROUP_NOT_FOUND",
  COMPONENT_GROUP_CREATE_FAILED: "COMPONENT_GROUP_CREATE_FAILED",
  COMPONENT_GROUP_UPDATE_FAILED: "COMPONENT_GROUP_UPDATE_FAILED",
  MONITOR_NOT_FOUND: "MONITOR_NOT_FOUND",
  SUBSCRIBER_NOT_FOUND: "SUBSCRIBER_NOT_FOUND",
  SUBSCRIBER_CREATE_FAILED: "SUBSCRIBER_CREATE_FAILED",
  IDENTIFIER_REQUIRED: "IDENTIFIER_REQUIRED",
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
 * Creates a "status page not found" error.
 */
export function statusPageNotFoundError(pageId: string): ConnectError {
  return createError(
    "Status page not found",
    Code.NotFound,
    ErrorReason.STATUS_PAGE_NOT_FOUND,
    { "page-id": pageId },
  );
}

/**
 * Creates a "status page ID required" error.
 */
export function statusPageIdRequiredError(): ConnectError {
  return createError(
    "Status page ID is required",
    Code.InvalidArgument,
    ErrorReason.STATUS_PAGE_ID_REQUIRED,
  );
}

/**
 * Creates a "failed to create status page" error.
 */
export function statusPageCreateFailedError(): ConnectError {
  return createError(
    "Failed to create status page",
    Code.Internal,
    ErrorReason.STATUS_PAGE_CREATE_FAILED,
  );
}

/**
 * Creates a "failed to update status page" error.
 */
export function statusPageUpdateFailedError(pageId: string): ConnectError {
  return createError(
    "Failed to update status page",
    Code.Internal,
    ErrorReason.STATUS_PAGE_UPDATE_FAILED,
    { "page-id": pageId },
  );
}

/**
 * Creates a "slug already exists" error.
 */
export function slugAlreadyExistsError(slug: string): ConnectError {
  return createError(
    "A status page with this slug already exists",
    Code.AlreadyExists,
    ErrorReason.SLUG_ALREADY_EXISTS,
    { slug },
  );
}

/**
 * Creates a "status page not published" error.
 * Used when trying to access an unpublished page via public slug.
 */
export function statusPageNotPublishedError(slug: string): ConnectError {
  return createError(
    "Status page is not published",
    Code.NotFound,
    ErrorReason.STATUS_PAGE_NOT_PUBLISHED,
    { slug },
  );
}

/**
 * Creates a "status page access denied" error.
 * Used when trying to access a protected page without proper authentication.
 */
export function statusPageAccessDeniedError(
  slug: string,
  accessType: string,
): ConnectError {
  return createError(
    `Status page requires ${accessType} access`,
    Code.PermissionDenied,
    ErrorReason.STATUS_PAGE_ACCESS_DENIED,
    { slug, "access-type": accessType },
  );
}

/**
 * Creates a "page component not found" error.
 */
export function pageComponentNotFoundError(componentId: string): ConnectError {
  return createError(
    "Page component not found",
    Code.NotFound,
    ErrorReason.PAGE_COMPONENT_NOT_FOUND,
    { "component-id": componentId },
  );
}

/**
 * Creates a "failed to create page component" error.
 */
export function pageComponentCreateFailedError(): ConnectError {
  return createError(
    "Failed to create page component",
    Code.Internal,
    ErrorReason.PAGE_COMPONENT_CREATE_FAILED,
  );
}

/**
 * Creates a "failed to update page component" error.
 */
export function pageComponentUpdateFailedError(
  componentId: string,
): ConnectError {
  return createError(
    "Failed to update page component",
    Code.Internal,
    ErrorReason.PAGE_COMPONENT_UPDATE_FAILED,
    { "component-id": componentId },
  );
}

/**
 * Creates a "component group not found" error.
 */
export function componentGroupNotFoundError(groupId: string): ConnectError {
  return createError(
    "Component group not found",
    Code.NotFound,
    ErrorReason.COMPONENT_GROUP_NOT_FOUND,
    { "group-id": groupId },
  );
}

/**
 * Creates a "failed to create component group" error.
 */
export function componentGroupCreateFailedError(): ConnectError {
  return createError(
    "Failed to create component group",
    Code.Internal,
    ErrorReason.COMPONENT_GROUP_CREATE_FAILED,
  );
}

/**
 * Creates a "failed to update component group" error.
 */
export function componentGroupUpdateFailedError(groupId: string): ConnectError {
  return createError(
    "Failed to update component group",
    Code.Internal,
    ErrorReason.COMPONENT_GROUP_UPDATE_FAILED,
    { "group-id": groupId },
  );
}

/**
 * Creates a "monitor not found" error.
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
 * Creates a "subscriber not found" error.
 */
export function subscriberNotFoundError(identifier: string): ConnectError {
  return createError(
    "Subscriber not found",
    Code.NotFound,
    ErrorReason.SUBSCRIBER_NOT_FOUND,
    { identifier },
  );
}

/**
 * Creates a "failed to create subscriber" error.
 */
export function subscriberCreateFailedError(): ConnectError {
  return createError(
    "Failed to create subscriber",
    Code.Internal,
    ErrorReason.SUBSCRIBER_CREATE_FAILED,
  );
}

/**
 * Creates an "identifier required" error.
 */
export function identifierRequiredError(): ConnectError {
  return createError(
    "Either email or token is required to identify the subscriber",
    Code.InvalidArgument,
    ErrorReason.IDENTIFIER_REQUIRED,
  );
}
