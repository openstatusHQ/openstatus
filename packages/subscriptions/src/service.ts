import { and, db, eq, inArray, isNotNull, isNull } from "@openstatus/db";
import {
  type Page,
  page,
  pageComponent,
  pageSubscription,
  pageSubscriptionToPageComponent,
} from "@openstatus/db/src/schema";

/**
 * Subscription Service Layer
 * Handles all subscription CRUD operations
 */

// Verification token expiry configuration
const VERIFICATION_EXPIRY_DAYS = 7;
const VERIFICATION_EXPIRY_MS = VERIFICATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Mask email address for privacy (e.g., "john@example.com" -> "j***@example.com")
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!domain) return email; // Invalid email, return as-is

  // Show first character + *** + @domain
  const masked = localPart.length > 0 ? `${localPart[0]}***` : "***";
  return `${masked}@${domain}`;
}

interface UpsertEmailSubscriptionInput {
  email: string;
  pageId: number;
  componentIds?: number[]; // Empty = entire page
}

interface UpdateSubscriptionScopeInput {
  token: string;
  componentIds: number[]; // New scope (replaces current)
  domain?: string; // Optional domain validation
}

/**
 * Create or update email subscription (ADD behavior)
 *
 * @param input - Subscription details
 * @param input.email - Email address (will be normalized to lowercase)
 * @param input.pageId - Page ID to subscribe to
 * @param input.componentIds - Optional array of component IDs. Empty array = entire page subscription
 *
 * @returns Subscription object with token for verification
 *
 * @throws Error if page not found or component IDs are invalid
 *
 * @example
 * ```ts
 * // Subscribe to entire page
 * const sub = await upsertEmailSubscription({
 *   email: "user@example.com",
 *   pageId: 123
 * });
 *
 * // Subscribe to specific components
 * const sub = await upsertEmailSubscription({
 *   email: "user@example.com",
 *   pageId: 123,
 *   componentIds: [1, 2, 3]
 * });
 * ```
 *
 * Behavior:
 * - If no active subscription exists: creates new subscription
 * - If active subscription exists: merges components (adds new ones)
 * - If unsubscribed subscription exists: reactivates with new token
 */
export async function upsertEmailSubscription(
  input: UpsertEmailSubscriptionInput,
) {
  const { email, pageId, componentIds = [] } = input;

  // Fetch page to get workspace_id and other data
  const pageData = await db.query.page.findFirst({
    where: eq(page.id, pageId),
  });

  if (!pageData) {
    throw new Error(`Page ${pageId} not found`);
  }

  // Validate component IDs belong to this page
  if (componentIds.length > 0) {
    const validComponents = await db
      .select({ id: pageComponent.id })
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.pageId, pageId),
          inArray(pageComponent.id, componentIds),
        ),
      )
      .all();

    if (validComponents.length !== componentIds.length) {
      const validIds = validComponents.map((c) => c.id);
      const invalidIds = componentIds.filter((id) => !validIds.includes(id));
      throw new Error(`Invalid components: ${invalidIds.join(", ")}`);
    }
  }

  // Check if there's an unsubscribed subscription first
  const unsubscribed = await db.query.pageSubscription.findFirst({
    where: and(
      eq(pageSubscription.email, email.toLowerCase()),
      eq(pageSubscription.pageId, pageId),
      eq(pageSubscription.channelType, "email"),
      isNotNull(pageSubscription.unsubscribedAt),
    ),
  });

  if (unsubscribed) {
    // Reactivate with new token
    return await reactivateSubscription(
      unsubscribed.id,
      componentIds,
      pageData,
    );
  }

  // Check if there's an active subscription
  const existing = await db.query.pageSubscription.findFirst({
    where: and(
      eq(pageSubscription.email, email.toLowerCase()),
      eq(pageSubscription.pageId, pageId),
      eq(pageSubscription.channelType, "email"),
      isNull(pageSubscription.unsubscribedAt),
    ),
    with: {
      components: true,
    },
  });

  if (existing) {
    // Active subscription exists - merge components (ADD behavior)
    const currentIds = existing.components.map((c) => c.pageComponentId);
    const mergedIds = [...new Set([...currentIds, ...componentIds])];

    // Add new components
    const newIds = mergedIds.filter((id) => !currentIds.includes(id));
    if (newIds.length > 0) {
      await db
        .insert(pageSubscriptionToPageComponent)
        .values(
          newIds.map((compId) => ({
            pageSubscriptionId: existing.id,
            pageComponentId: compId,
          })),
        )
        .run();
    }

    // If not verified yet, update expiry
    if (!existing.verifiedAt) {
      const newExpiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);
      await db
        .update(pageSubscription)
        .set({
          expiresAt: newExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(pageSubscription.id, existing.id))
        .run();
    }

    return {
      id: existing.id,
      pageId: existing.pageId,
      pageName: pageData.title,
      pageSlug: pageData.slug,
      customDomain: pageData.customDomain,
      workspaceId: existing.workspaceId,
      channelType: existing.channelType,
      email: existing.email ?? undefined,
      token: existing.token,
      verifiedAt: existing.verifiedAt ?? undefined,
      componentIds: mergedIds,
    };
  }

  // No existing subscription - create new one
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

  const subscription = await db.transaction(async (tx) => {
    const sub = await tx
      .insert(pageSubscription)
      .values({
        channelType: "email",
        email: email.toLowerCase(),
        webhookUrl: null,
        pageId,
        workspaceId: pageData.workspaceId,
        token,
        expiresAt,
      })
      .returning()
      .get();

    // Insert junction table rows if components specified
    if (componentIds.length > 0) {
      await tx
        .insert(pageSubscriptionToPageComponent)
        .values(
          componentIds.map((compId) => ({
            pageSubscriptionId: sub.id,
            pageComponentId: compId,
          })),
        )
        .run();
    }

    return sub;
  });

  return {
    id: subscription.id,
    pageId: subscription.pageId,
    pageName: pageData.title,
    pageSlug: pageData.slug,
    customDomain: pageData.customDomain,
    workspaceId: subscription.workspaceId,
    channelType: "email",
    email: subscription.email ?? undefined,
    token: subscription.token,
    verifiedAt: subscription.verifiedAt ?? undefined,
    unsubscribedAt: subscription.unsubscribedAt ?? undefined,
    componentIds: componentIds,
  };
}

/**
 * Reactivate an unsubscribed subscription with new token and scope
 */
async function reactivateSubscription(
  subscriptionId: number,
  newComponentIds: number[],
  pageData: Pick<
    Page,
    "id" | "workspaceId" | "title" | "slug" | "customDomain"
  >,
) {
  const newToken = crypto.randomUUID();
  const newExpiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

  const updated = await db.transaction(async (tx) => {
    // Reactivate subscription
    const sub = await tx
      .update(pageSubscription)
      .set({
        unsubscribedAt: null,
        verifiedAt: null, // Require re-verification
        token: newToken,
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(pageSubscription.id, subscriptionId))
      .returning()
      .get();

    // Update component scope
    await tx
      .delete(pageSubscriptionToPageComponent)
      .where(
        eq(pageSubscriptionToPageComponent.pageSubscriptionId, subscriptionId),
      )
      .run();

    if (newComponentIds.length > 0) {
      await tx
        .insert(pageSubscriptionToPageComponent)
        .values(
          newComponentIds.map((id) => ({
            pageSubscriptionId: subscriptionId,
            pageComponentId: id,
          })),
        )
        .run();
    }

    return sub;
  });

  return {
    id: updated.id,
    pageId: updated.pageId,
    pageName: pageData.title,
    pageSlug: pageData.slug,
    customDomain: pageData.customDomain,
    workspaceId: updated.workspaceId,
    channelType: "email",
    email: updated.email ?? undefined,
    token: updated.token,
    verifiedAt: undefined, // Just reactivated, not verified
    componentIds: newComponentIds,
  };
}

/**
 * Verify a subscription by token
 *
 * @param token - Unique verification token from the subscription
 * @param domain - Optional domain validation (page slug or custom domain)
 *
 * @returns Verified subscription object, or null if not found/invalid domain
 *
 * @throws Error if verification token is expired
 *
 * @example
 * ```ts
 * const verified = await verifySubscription(token, "status.example.com");
 * ```
 */
export async function verifySubscription(token: string, domain?: string) {
  const subscription = await db.query.pageSubscription.findFirst({
    where: eq(pageSubscription.token, token),
    with: {
      page: true,
      components: true,
    },
  });

  if (!subscription) {
    return null;
  }

  // Validate domain if provided (extra security layer)
  if (domain) {
    const domainLower = domain.toLowerCase();
    const pageSlugLower = subscription.page.slug.toLowerCase();
    const customDomainLower = subscription.page.customDomain?.toLowerCase();

    if (domainLower !== pageSlugLower && domainLower !== customDomainLower) {
      return null;
    }
  }

  // Check if already verified
  if (subscription.verifiedAt) {
    return {
      id: subscription.id,
      pageId: subscription.pageId,
      pageName: subscription.page.title,
      pageSlug: subscription.page.slug,
      customDomain: subscription.page.customDomain,
      workspaceId: subscription.workspaceId,
      channelType: subscription.channelType as "email" | "webhook",
      email: subscription.email ?? undefined,
      webhookUrl: subscription.webhookUrl ?? undefined,
      token: subscription.token,
      verifiedAt: subscription.verifiedAt ?? undefined,
      unsubscribedAt: subscription.unsubscribedAt ?? undefined,
      componentIds: subscription.components.map((c) => c.pageComponentId),
    };
  }

  // Check if expired (only for verification flow)
  if (subscription.expiresAt && subscription.expiresAt < new Date()) {
    throw new Error("Verification token expired");
  }

  // Mark as verified
  const updated = await db
    .update(pageSubscription)
    .set({
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pageSubscription.id, subscription.id))
    .returning()
    .get();

  return {
    id: updated.id,
    pageId: updated.pageId,
    pageName: subscription.page.title,
    pageSlug: subscription.page.slug,
    customDomain: subscription.page.customDomain,
    workspaceId: updated.workspaceId,
    channelType: updated.channelType as "email" | "webhook",
    email: updated.email ?? undefined,
    webhookUrl: updated.webhookUrl ?? undefined,
    token: updated.token,
    verifiedAt: updated.verifiedAt ?? undefined,
    componentIds: subscription.components.map((c) => c.pageComponentId),
  };
}

/**
 * Get subscription by token (for management UI)
 *
 * @param token - Unique subscription token
 * @param domain - Optional domain validation (page slug or custom domain)
 *
 * @returns Subscription object with all details, or null if not found/invalid domain
 *
 * @example
 * ```ts
 * const sub = await getSubscriptionByToken(token, "status.example.com");
 * if (sub) {
 *   console.log(`Subscribed to ${sub.componentIds.length || "all"} components`);
 * }
 * ```
 */
export async function getSubscriptionByToken(token: string, domain?: string) {
  const subscription = await db.query.pageSubscription.findFirst({
    where: eq(pageSubscription.token, token),
    with: {
      page: true,
      components: true,
    },
  });

  if (!subscription) {
    return null;
  }

  // Validate domain if provided (extra security layer)
  if (domain) {
    const domainLower = domain.toLowerCase();
    const pageSlugLower = subscription.page.slug.toLowerCase();
    const customDomainLower = subscription.page.customDomain?.toLowerCase();

    if (domainLower !== pageSlugLower && domainLower !== customDomainLower) {
      return null;
    }
  }

  return {
    id: subscription.id,
    pageId: subscription.pageId,
    pageName: subscription.page.title,
    pageSlug: subscription.page.slug,
    customDomain: subscription.page.customDomain,
    workspaceId: subscription.workspaceId,
    channelType: subscription.channelType as "email" | "webhook",
    email: subscription.email ? maskEmail(subscription.email) : undefined,
    webhookUrl: subscription.webhookUrl ?? undefined,
    token: subscription.token,
    verifiedAt: subscription.verifiedAt ?? undefined,
    unsubscribedAt: subscription.unsubscribedAt ?? undefined,
    componentIds: subscription.components.map((c) => c.pageComponentId),
  };
}

/**
 * Update subscription scope (replace all components)
 *
 * @param input - Update details
 * @param input.token - Subscription token
 * @param input.componentIds - New component IDs (replaces existing). Empty array = entire page
 * @param input.domain - Optional domain validation (page slug or custom domain)
 *
 * @returns Updated subscription object
 *
 * @throws Error if subscription not found, invalid domain, or component IDs don't belong to page
 *
 * @example
 * ```ts
 * // Update to specific components
 * await updateSubscriptionScope({
 *   token: "abc-123",
 *   componentIds: [1, 2],
 *   domain: "status.example.com"
 * });
 *
 * // Update to entire page
 * await updateSubscriptionScope({
 *   token: "abc-123",
 *   componentIds: []
 * });
 * ```
 */
export async function updateSubscriptionScope(
  input: UpdateSubscriptionScopeInput,
) {
  const { token, componentIds, domain } = input;

  const subscription = await db.query.pageSubscription.findFirst({
    where: eq(pageSubscription.token, token),
    with: {
      page: true,
      components: true,
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  // Validate domain if provided (extra security layer)
  if (domain) {
    const domainLower = domain.toLowerCase();
    const pageSlugLower = subscription.page.slug.toLowerCase();
    const customDomainLower = subscription.page.customDomain?.toLowerCase();

    if (domainLower !== pageSlugLower && domainLower !== customDomainLower) {
      throw new Error("Subscription not found");
    }
  }

  // Validate component IDs belong to this page
  if (componentIds.length > 0) {
    const validComponents = await db
      .select({ id: pageComponent.id })
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.pageId, subscription.pageId),
          inArray(pageComponent.id, componentIds),
        ),
      )
      .all();

    if (validComponents.length !== componentIds.length) {
      throw new Error("Some components do not belong to this page");
    }
  }

  // Update in transaction: delete all + add new
  await db.transaction(async (tx) => {
    // Delete all existing component associations
    await tx
      .delete(pageSubscriptionToPageComponent)
      .where(
        eq(pageSubscriptionToPageComponent.pageSubscriptionId, subscription.id),
      )
      .run();

    // Insert new associations
    if (componentIds.length > 0) {
      await tx
        .insert(pageSubscriptionToPageComponent)
        .values(
          componentIds.map((id) => ({
            pageSubscriptionId: subscription.id,
            pageComponentId: id,
          })),
        )
        .run();
    }

    // Update timestamp
    await tx
      .update(pageSubscription)
      .set({ updatedAt: new Date() })
      .where(eq(pageSubscription.id, subscription.id))
      .run();
  });

  return {
    id: subscription.id,
    pageId: subscription.pageId,
    pageName: subscription.page.title,
    pageSlug: subscription.page.slug,
    customDomain: subscription.page.customDomain,
    workspaceId: subscription.workspaceId,
    channelType: subscription.channelType as "email" | "webhook",
    email: subscription.email ?? undefined,
    token: subscription.token,
    verifiedAt: subscription.verifiedAt ?? undefined,
    componentIds,
  };
}

/**
 * Unsubscribe by token
 *
 * @param token - Subscription token
 * @param domain - Optional domain validation (page slug or custom domain)
 *
 * @throws Error if subscription not found, invalid domain, or already unsubscribed
 *
 * @example
 * ```ts
 * await unsubscribe(token, "status.example.com");
 * ```
 */
export async function unsubscribe(token: string, domain?: string) {
  const subscription = await db.query.pageSubscription.findFirst({
    where: eq(pageSubscription.token, token),
    with: {
      page: true,
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  // Validate domain if provided (extra security layer)
  if (domain) {
    const domainLower = domain.toLowerCase();
    const pageSlugLower = subscription.page.slug.toLowerCase();
    const customDomainLower = subscription.page.customDomain?.toLowerCase();

    if (domainLower !== pageSlugLower && domainLower !== customDomainLower) {
      throw new Error("Subscription not found");
    }
  }

  if (subscription.unsubscribedAt) {
    throw new Error("Already unsubscribed");
  }

  await db
    .update(pageSubscription)
    .set({
      unsubscribedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pageSubscription.id, subscription.id))
    .run();
}
