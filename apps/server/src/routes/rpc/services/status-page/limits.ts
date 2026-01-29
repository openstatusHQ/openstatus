import { Code, ConnectError } from "@connectrpc/connect";
import { db, eq, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";

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
    .select({ count: sql<number>`count(*)` })
    .from(page)
    .where(eq(page.workspaceId, workspaceId))
    .get();

  const count = countResult?.count ?? 0;
  if (count >= limits["status-pages"]) {
    throw new ConnectError(
      "Upgrade for more status pages",
      Code.PermissionDenied,
    );
  }
}

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
