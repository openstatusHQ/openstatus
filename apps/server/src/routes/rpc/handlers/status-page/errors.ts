import { Code, type ConnectError } from "@connectrpc/connect";

import { ErrorReason, idRequiredError, rpcError } from "../../errors";

export { monitorNotFoundError, pageComponentNotFoundError } from "../../errors";

export function statusPageNotFoundError(pageId: string): ConnectError {
  return rpcError({
    code: Code.NotFound,
    reason: ErrorReason.STATUS_PAGE_NOT_FOUND,
    message: "Status page not found",
    metadata: { pageId },
  });
}

export function statusPageIdRequiredError(): ConnectError {
  return idRequiredError("Status page");
}

export function slugAlreadyExistsError(slug: string): ConnectError {
  return rpcError({
    code: Code.AlreadyExists,
    reason: ErrorReason.SLUG_ALREADY_EXISTS,
    message: "A status page with this slug already exists",
    metadata: { slug },
  });
}

/** Unpublished pages are invisible on the public slug lookup. */
export function statusPageNotPublishedError(slug: string): ConnectError {
  return rpcError({
    code: Code.NotFound,
    reason: ErrorReason.STATUS_PAGE_NOT_PUBLISHED,
    message: "Status page is not published",
    metadata: { slug },
  });
}

export function statusPageAccessDeniedError(
  slug: string,
  accessType: string,
): ConnectError {
  return rpcError({
    code: Code.PermissionDenied,
    reason: ErrorReason.STATUS_PAGE_ACCESS_DENIED,
    message: `Status page requires ${accessType} access`,
    metadata: { slug, accessType },
  });
}

export function componentGroupNotFoundError(groupId: string): ConnectError {
  return rpcError({
    code: Code.NotFound,
    reason: ErrorReason.COMPONENT_GROUP_NOT_FOUND,
    message: "Component group not found",
    metadata: { groupId },
  });
}

export function subscriberNotFoundError(identifier: string): ConnectError {
  return rpcError({
    code: Code.NotFound,
    reason: ErrorReason.SUBSCRIBER_NOT_FOUND,
    message: "Subscriber not found",
    metadata: { identifier },
  });
}

export function subscriberCreateFailedError(): ConnectError {
  return rpcError({
    code: Code.Internal,
    reason: ErrorReason.INTERNAL_SERVER_ERROR,
    message: "Failed to create subscriber",
  });
}

export function identifierRequiredError(): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.IDENTIFIER_REQUIRED,
    message: "Either email or token is required to identify the subscriber",
  });
}

export function invalidCustomDomainError(domain: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.INVALID_CUSTOM_DOMAIN,
    message:
      "Custom domain must not contain 'openstatus' or start with http://, https://, or www.",
    metadata: { customDomain: domain },
  });
}

export function invalidIconUrlError(): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.INVALID_ICON_URL,
    message: "Icon must be a valid URL",
  });
}

export function passwordRequiredError(): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.PASSWORD_REQUIRED,
    message: "Password is required when access_type is PASSWORD_PROTECTED",
  });
}

export function authEmailDomainsRequiredError(): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.AUTH_EMAIL_DOMAINS_REQUIRED,
    message:
      "At least one email domain is required when access_type is AUTHENTICATED",
  });
}
