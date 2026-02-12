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
 * - If no active subscription exists: create new
 * - If active subscription exists: merge components
 * - If unsubscribed subscription exists: reactivate with new token
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
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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
      channelType: "email",
      email: existing.email ?? undefined,
      token: existing.token,
      verifiedAt: existing.verifiedAt ?? undefined,
      componentIds: mergedIds,
    };
  }

  // No existing subscription - create new one
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

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
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
    email: subscription.email ?? undefined,
    webhookUrl: subscription.webhookUrl ?? undefined,
    token: subscription.token,
    verifiedAt: subscription.verifiedAt ?? undefined,
    unsubscribedAt: subscription.unsubscribedAt ?? undefined,
    componentIds: subscription.components.map((c) => c.pageComponentId),
  };
}

/**
 * Update subscription scope (replace all components)
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
