import { and, eq } from "@openstatus/db";
import { page, selectWorkspaceSchema } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";

/**
 * Page-in-workspace guard with the owning workspace eagerly loaded — so
 * callers that need to plan-gate off `workspace.limits` don't have to
 * issue a second query.
 */
export async function loadPageForWorkspace(args: {
  tx: DB;
  pageId: number;
  workspaceId: number;
}) {
  const row = await args.tx.query.page.findFirst({
    where: and(
      eq(page.workspaceId, args.workspaceId),
      eq(page.id, args.pageId),
    ),
    with: { workspace: true },
  });
  if (!row) {
    throw new NotFoundError("page", args.pageId);
  }
  return row;
}

/**
 * Plan-gate: enterprise / Pro plans have `status-subscribers: true`; free
 * plan is `false`. Preserves the legacy FORBIDDEN semantics (not 429) —
 * it's not a rate limit, the feature is a tier upsell.
 */
export function assertSubscribersAllowed(pageWithWorkspace: {
  workspace: unknown;
}): void {
  const workspace = selectWorkspaceSchema.safeParse(
    pageWithWorkspace.workspace,
  );
  if (!workspace.success) {
    throw new ValidationError("Workspace data is invalid");
  }
  if (!workspace.data.limits["status-subscribers"]) {
    throw new ForbiddenError("Upgrade to use status subscribers");
  }
}

/**
 * Messages thrown by `@openstatus/subscriptions` that represent caller-
 * facing validation rather than internal failure. Surfacing the message
 * verbatim is safe (verified by review when each variant is added); any
 * other thrown message should bubble as INTERNAL so we never leak row
 * ids, raw SQL, or unvetted strings.
 *
 * Single source of truth for both the protected (dashboard) procedures —
 * which go through this file — and the public (status-page) procedures,
 * which import the set via `SAFE_SUBSCRIPTION_MESSAGES`.
 */
export const SAFE_SUBSCRIPTION_MESSAGES = new Set<string>([
  "Page not found",
  "Some components do not belong to this page",
  "A subscriber with this email already exists for this page.",
  "A subscriber with this webhook URL already exists for this page.",
  "Only Slack and Discord webhook URLs are supported.",
  "Subscriber not found",
  "Subscriber is not a webhook channel",
  "Self-signup subscribers manage their own subscription; use the unsubscribe action instead.",
  "Email subscribers do not have webhook fields to edit.",
  "Only vendor-added webhook subscribers support test dispatch.",
  "Subscription not found",
  "Subscription not yet verified",
  "Subscription is unsubscribed",
  "Verification token expired",
]);

/**
 * Rethrow a `subscriptions` error either as a `ValidationError` (for the
 * allow-listed message set) or as the original error — the outer adapter
 * maps anything non-ServiceError to `INTERNAL_SERVER_ERROR`, so unknown
 * messages don't leak to clients.
 */
export function rethrowSubscriptionError(error: unknown): never {
  if (error instanceof Error && SAFE_SUBSCRIPTION_MESSAGES.has(error.message)) {
    throw new ValidationError(error.message);
  }
  throw error;
}
