import { Code, ConnectError } from "@connectrpc/connect";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";

/**
 * Check if custom domain feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkCustomDomainLimit(limits: Limits): void {
  if (!limits["custom-domain"]) {
    throw new ConnectError("Upgrade for custom domains", Code.PermissionDenied);
  }
}

/**
 * Check if password protection feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkPasswordProtectionLimit(limits: Limits): void {
  if (!limits["password-protection"]) {
    throw new ConnectError(
      "Upgrade for password protection",
      Code.PermissionDenied,
    );
  }
}

/**
 * Check if email domain protection feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkEmailDomainProtectionLimit(limits: Limits): void {
  if (!limits["email-domain-protection"]) {
    throw new ConnectError(
      "Upgrade for email domain protection",
      Code.PermissionDenied,
    );
  }
}

/**
 * Check if IP restriction feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkIpRestrictionLimit(limits: Limits): void {
  if (!limits["ip-restriction"]) {
    throw new ConnectError("Upgrade for IP restriction", Code.PermissionDenied);
  }
}

/**
 * Check if no-index feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkNoIndexLimit(limits: Limits): void {
  if (!limits["no-index"]) {
    throw new ConnectError(
      "Upgrade for search engine indexing toggle",
      Code.PermissionDenied,
    );
  }
}

/**
 * Check if the custom theme feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkCustomThemeLimit(limits: Limits): void {
  if (!limits["custom-theme"]) {
    throw new ConnectError("Upgrade for custom theme", Code.PermissionDenied);
  }
}

export function checkStatusSubscribersLimit(limits: Limits): void {
  if (!limits["status-subscribers"]) {
    throw new ConnectError(
      "Upgrade to use status subscribers",
      Code.PermissionDenied,
    );
  }
}
