import { count, db, eq } from "@openstatus/db";
import { page, pageComponent } from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";

import {
  planFeatureNotAvailableError,
  planLimitReachedError,
} from "../../errors";

/**
 * Check workspace limits for creating a new status page.
 * Throws ConnectError with PermissionDenied if limit is exceeded.
 */
export async function checkStatusPageLimits(
  workspaceId: number,
  limits: Limits,
): Promise<void> {
  // Check status page count limit
  const countResult = await db
    .select({ count: count() })
    .from(page)
    .where(eq(page.workspaceId, workspaceId))
    .get();

  const currentCount = countResult?.count ?? 0;
  if (currentCount >= limits["status-pages"]) {
    throw planLimitReachedError(
      "Upgrade for more status pages",
      "status-pages",
      limits["status-pages"],
      currentCount,
    );
  }
}

/**
 * Check if custom domain feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkCustomDomainLimit(limits: Limits): void {
  if (!limits["custom-domain"]) {
    throw planFeatureNotAvailableError(
      "Upgrade for custom domains",
      "custom-domain",
    );
  }
}

/**
 * Check if password protection feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkPasswordProtectionLimit(limits: Limits): void {
  if (!limits["password-protection"]) {
    throw planFeatureNotAvailableError(
      "Upgrade for password protection",
      "password-protection",
    );
  }
}

/**
 * Check if email domain protection feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkEmailDomainProtectionLimit(limits: Limits): void {
  if (!limits["email-domain-protection"]) {
    throw planFeatureNotAvailableError(
      "Upgrade for email domain protection",
      "email-domain-protection",
    );
  }
}

/**
 * Check if IP restriction feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkIpRestrictionLimit(limits: Limits): void {
  if (!limits["ip-restriction"]) {
    throw planFeatureNotAvailableError(
      "Upgrade for IP restriction",
      "ip-restriction",
    );
  }
}

/**
 * Check if no-index feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkNoIndexLimit(limits: Limits): void {
  if (!limits["no-index"]) {
    throw planFeatureNotAvailableError(
      "Upgrade for search engine indexing toggle",
      "no-index",
    );
  }
}

/**
 * Check if the custom theme feature is available on the workspace plan.
 * Throws ConnectError with PermissionDenied if not available.
 */
export function checkCustomThemeLimit(limits: Limits): void {
  if (!limits["custom-theme"]) {
    throw planFeatureNotAvailableError(
      "Upgrade for custom theme",
      "custom-theme",
    );
  }
}

export function checkStatusSubscribersLimit(limits: Limits): void {
  if (!limits["status-subscribers"]) {
    throw planFeatureNotAvailableError(
      "Upgrade to use status subscribers",
      "status-subscribers",
    );
  }
}

/**
 * Check workspace limits for creating a new page component.
 * Throws ConnectError with PermissionDenied if limit is exceeded.
 */
export async function checkPageComponentLimits(
  pageId: number,
  limits: Limits,
): Promise<void> {
  const countResult = await db
    .select({ count: count() })
    .from(pageComponent)
    .where(eq(pageComponent.pageId, pageId))
    .get();

  const currentCount = countResult?.count ?? 0;
  if (currentCount >= limits["page-components"]) {
    throw planLimitReachedError(
      "Upgrade for more page components",
      "page-components",
      limits["page-components"],
      currentCount,
    );
  }
}
