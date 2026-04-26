import { and, eq } from "@openstatus/db";
import {
  type Workspace,
  page,
  pageSubscriber,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";

import { type DB, type ServiceContext, getReadDb } from "../context";
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
export function assertSubscribersAllowed(workspace: Workspace): void {
  if (!workspace.limits["status-subscribers"]) {
    throw new ForbiddenError("Upgrade to use status subscribers");
  }
}

/**
 * Parse a `workspace` row (from a drizzle relational `with: { workspace: true }`
 * fetch) into the schema-validated `Workspace` shape that `ServiceContext`
 * expects. The raw row carries `limits` as a JSON string; the schema parses
 * it into the structured limits object.
 */
export function parseWorkspaceForContext(workspaceRow: unknown): Workspace {
  const parsed = selectWorkspaceSchema.safeParse(workspaceRow);
  if (!parsed.success) {
    throw new ValidationError("Workspace data is invalid");
  }
  return parsed.data;
}

export type ResolvedSubscriber = {
  row: typeof pageSubscriber.$inferSelect;
  pageData: {
    id: number;
    title: string;
    slug: string;
    customDomain: string | null;
    workspace: Workspace;
  };
  components: number[];
};

/**
 * Token-addressed lookup used by every public-facing subscriber verb
 * (`verify`, `getByToken`, `updateScope`, `unsubscribe`). Returns the
 * subscriber row, the parsed page+workspace (so callers can build a
 * `ServiceContext` for audit emission), and the current component-id
 * scope. Returns `null` if the token doesn't resolve, or if the
 * optional `domain` doesn't match the page slug or its custom domain —
 * we don't distinguish those two failures (no leak of which pages exist
 * for a given token).
 */
export async function resolveSubscriberByToken(args: {
  db?: DB;
  token: string;
  domain?: string;
}): Promise<ResolvedSubscriber | null> {
  const readDb = getReadDb({ db: args.db } as ServiceContext);
  const subscription = await readDb.query.pageSubscriber.findFirst({
    where: eq(pageSubscriber.token, args.token),
    with: {
      page: { with: { workspace: true } },
      components: true,
    },
  });
  if (!subscription) return null;

  if (args.domain) {
    const domainLower = args.domain.toLowerCase();
    const pageSlugLower = subscription.page.slug.toLowerCase();
    const customDomainLower = subscription.page.customDomain?.toLowerCase();
    if (domainLower !== pageSlugLower && domainLower !== customDomainLower) {
      return null;
    }
  }

  const workspace = parseWorkspaceForContext(subscription.page.workspace);
  const { components, page: pageRow, ...row } = subscription;
  return {
    row,
    pageData: {
      id: pageRow.id,
      title: pageRow.title,
      slug: pageRow.slug,
      customDomain: pageRow.customDomain,
      workspace,
    },
    components: components.map((c) => c.pageComponentId),
  };
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
