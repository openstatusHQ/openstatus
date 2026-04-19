import { and, db, eq, inArray, isNull } from "@openstatus/db";
import {
  page,
  pageComponent,
  pageSubscriber,
  pageSubscriberToPageComponent,
} from "@openstatus/db/src/schema";
import { assertSafeUrl } from "@openstatus/utils";
import {
  detectWebhookFlavor,
  sendTestWebhookRequest,
} from "./channels/webhook";

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
  if (!domain) return email;

  const masked = localPart.length > 0 ? `${localPart[0]}***` : "***";
  return `${masked}@${domain}`;
}

function maskWebhookUrl(webhookUrl: string): string {
  const url = new URL(webhookUrl);
  return `${url.origin}***`;
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
 * - If no subscription exists (or only unsubscribed ones): creates new subscription
 * - If pending subscription exists: merges components and refreshes expiry
 * - If verified subscription exists: returns as-is (caller handles "already subscribed")
 */
export async function upsertEmailSubscription(
  input: UpsertEmailSubscriptionInput,
) {
  const { email, pageId, componentIds = [] } = input;

  const pageData = await db.query.page.findFirst({
    where: eq(page.id, pageId),
  });

  if (!pageData) {
    throw new Error("Page not found");
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
      throw new Error("Some components do not belong to this page");
    }
  }

  // Check for active subscription
  const existing = await db.query.pageSubscriber.findFirst({
    where: and(
      eq(pageSubscriber.email, email.toLowerCase()),
      eq(pageSubscriber.pageId, pageId),
      eq(pageSubscriber.channelType, "email"),
      isNull(pageSubscriber.unsubscribedAt),
    ),
    with: {
      components: true,
    },
  });

  if (existing) {
    // Already verified — return as-is without merging components.
    // The caller (tRPC subscribe) will throw "Email already subscribed" on acceptedAt.
    if (existing.acceptedAt) {
      return {
        id: existing.id,
        pageId: existing.pageId,
        pageName: pageData.title,
        pageSlug: pageData.slug,
        customDomain: pageData.customDomain,
        channelType: existing.channelType,
        email: existing.email ?? undefined,
        token: existing.token,
        acceptedAt: existing.acceptedAt,
        componentIds: existing.components.map((c) => c.pageComponentId),
      };
    }

    // Pending — merge new components and refresh expiry
    const currentIds = existing.components.map((c) => c.pageComponentId);
    const mergedIds = [...new Set([...currentIds, ...componentIds])];

    const newIds = mergedIds.filter((id) => !currentIds.includes(id));
    if (newIds.length > 0) {
      await db
        .insert(pageSubscriberToPageComponent)
        .values(
          newIds.map((compId) => ({
            pageSubscriberId: existing.id,
            pageComponentId: compId,
          })),
        )
        .onConflictDoNothing()
        .run();
    }

    const newExpiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);
    await db
      .update(pageSubscriber)
      .set({ expiresAt: newExpiresAt, updatedAt: new Date() })
      .where(eq(pageSubscriber.id, existing.id))
      .run();

    return {
      id: existing.id,
      pageId: existing.pageId,
      pageName: pageData.title,
      pageSlug: pageData.slug,
      customDomain: pageData.customDomain,
      channelType: existing.channelType,
      email: existing.email ?? undefined,
      token: existing.token,
      acceptedAt: undefined,
      componentIds: mergedIds,
    };
  }

  // No existing subscription — create new one
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

  const subscription = await db.transaction(async (tx) => {
    const sub = await tx
      .insert(pageSubscriber)
      .values({
        channelType: "email",
        email: email.toLowerCase(),
        webhookUrl: null,
        pageId,
        token,
        expiresAt,
      })
      .returning()
      .get();

    if (componentIds.length > 0) {
      await tx
        .insert(pageSubscriberToPageComponent)
        .values(
          componentIds.map((compId) => ({
            pageSubscriberId: sub.id,
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
    channelType: "email" as const,
    email: subscription.email ?? undefined,
    token: subscription.token,
    acceptedAt: subscription.acceptedAt ?? undefined,
    unsubscribedAt: subscription.unsubscribedAt ?? undefined,
    componentIds,
  };
}

/**
 * Verify a subscription by token
 */
export async function verifySubscription(token: string, domain?: string) {
  const subscription = await db.query.pageSubscriber.findFirst({
    where: eq(pageSubscriber.token, token),
    with: {
      page: true,
      components: true,
    },
  });

  if (!subscription) {
    return null;
  }

  // Validate domain if provided
  if (domain) {
    const domainLower = domain.toLowerCase();
    const pageSlugLower = subscription.page.slug.toLowerCase();
    const customDomainLower = subscription.page.customDomain?.toLowerCase();

    if (domainLower !== pageSlugLower && domainLower !== customDomainLower) {
      return null;
    }
  }

  // Already accepted
  if (subscription.acceptedAt) {
    return {
      id: subscription.id,
      pageId: subscription.pageId,
      pageName: subscription.page.title,
      pageSlug: subscription.page.slug,
      customDomain: subscription.page.customDomain,
      channelType: subscription.channelType as "email" | "webhook",
      email: subscription.email ?? undefined,
      webhookUrl: subscription.webhookUrl ?? undefined,
      token: subscription.token,
      acceptedAt: subscription.acceptedAt ?? undefined,
      unsubscribedAt: subscription.unsubscribedAt ?? undefined,
      componentIds: subscription.components.map((c) => c.pageComponentId),
    };
  }

  // Check if expired
  if (subscription.expiresAt && subscription.expiresAt < new Date()) {
    throw new Error("Verification token expired");
  }

  // Mark as accepted
  const updated = await db
    .update(pageSubscriber)
    .set({ acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(pageSubscriber.id, subscription.id))
    .returning()
    .get();

  return {
    id: updated.id,
    pageId: updated.pageId,
    pageName: subscription.page.title,
    pageSlug: subscription.page.slug,
    customDomain: subscription.page.customDomain,
    channelType: updated.channelType as "email" | "webhook",
    email: updated.email ?? undefined,
    webhookUrl: updated.webhookUrl ?? undefined,
    token: updated.token,
    acceptedAt: updated.acceptedAt ?? undefined,
    componentIds: subscription.components.map((c) => c.pageComponentId),
  };
}

/**
 * Get subscription by token (for management UI)
 */
export async function getSubscriptionByToken(token: string, domain?: string) {
  const subscription = await db.query.pageSubscriber.findFirst({
    where: eq(pageSubscriber.token, token),
    with: {
      page: true,
      components: true,
    },
  });

  if (!subscription) {
    return null;
  }

  if (domain) {
    const domainLower = domain.toLowerCase();
    const pageSlugLower = subscription.page.slug.toLowerCase();
    const customDomainLower = subscription.page.customDomain?.toLowerCase();

    if (domainLower !== pageSlugLower && domainLower !== customDomainLower) {
      return null;
    }
  }

  // Intentionally omitting webhookUrl/channelConfig — this is a public,
  // token-addressed endpoint and webhook URLs embed credential-bearing
  // paths that shouldn't leave the server.
  return {
    id: subscription.id,
    pageId: subscription.pageId,
    pageName: subscription.page.title,
    pageSlug: subscription.page.slug,
    customDomain: subscription.page.customDomain,
    channelType: subscription.channelType as "email" | "webhook",
    email: subscription.email ? maskEmail(subscription.email) : undefined,
    webhookUrl: subscription.webhookUrl
      ? maskWebhookUrl(subscription.webhookUrl)
      : undefined,
    acceptedAt: subscription.acceptedAt ?? undefined,
    unsubscribedAt: subscription.unsubscribedAt ?? undefined,
    componentIds: subscription.components.map((c) => c.pageComponentId),
  };
}

/**
 * Check whether an email already has a pending (unverified, unexpired) subscription for a page.
 * Used to prevent re-sending verification emails for already-pending subscriptions.
 */
export async function hasPendingUnexpiredSubscription(
  email: string,
  pageId: number,
): Promise<boolean> {
  const existing = await db.query.pageSubscriber.findFirst({
    where: and(
      eq(pageSubscriber.email, email.toLowerCase()),
      eq(pageSubscriber.pageId, pageId),
      eq(pageSubscriber.channelType, "email"),
      isNull(pageSubscriber.unsubscribedAt),
      isNull(pageSubscriber.acceptedAt),
    ),
  });
  return !!(existing?.expiresAt && existing.expiresAt > new Date());
}

/**
 * Update subscription scope (replace all components)
 */
export async function updateSubscriptionScope(
  input: UpdateSubscriptionScopeInput,
) {
  const { token, componentIds, domain } = input;

  const subscription = await db.query.pageSubscriber.findFirst({
    where: eq(pageSubscriber.token, token),
    with: {
      page: true,
      components: true,
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (domain) {
    const domainLower = domain.toLowerCase();
    const pageSlugLower = subscription.page.slug.toLowerCase();
    const customDomainLower = subscription.page.customDomain?.toLowerCase();

    if (domainLower !== pageSlugLower && domainLower !== customDomainLower) {
      throw new Error("Subscription not found");
    }
  }

  if (!subscription.acceptedAt) {
    throw new Error("Subscription not yet verified");
  }

  if (subscription.unsubscribedAt) {
    throw new Error("Subscription is unsubscribed");
  }

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

  await db.transaction(async (tx) => {
    await tx
      .delete(pageSubscriberToPageComponent)
      .where(
        eq(pageSubscriberToPageComponent.pageSubscriberId, subscription.id),
      )
      .run();

    if (componentIds.length > 0) {
      await tx
        .insert(pageSubscriberToPageComponent)
        .values(
          componentIds.map((id) => ({
            pageSubscriberId: subscription.id,
            pageComponentId: id,
          })),
        )
        .run();
    }

    await tx
      .update(pageSubscriber)
      .set({ updatedAt: new Date() })
      .where(eq(pageSubscriber.id, subscription.id))
      .run();
  });

  return {
    id: subscription.id,
    pageId: subscription.pageId,
    pageName: subscription.page.title,
    pageSlug: subscription.page.slug,
    customDomain: subscription.page.customDomain,
    channelType: subscription.channelType as "email" | "webhook",
    email: subscription.email ?? undefined,
    token: subscription.token,
    acceptedAt: subscription.acceptedAt ?? undefined,
    componentIds,
  };
}

/**
 * Create a vendor-added subscription (channel-agnostic).
 *
 * Skips the verification flow: `source = "vendor"`, `acceptedAt`
 * stamped at creation, `expiresAt = null`. Token is still generated so the
 * partner can self-manage via the existing `/manage/{token}` and
 * `/unsubscribe/{token}` routes.
 */
export type CreateSubscriptionInput =
  | {
      pageId: number;
      channelType: "email";
      email: string;
      name?: string | null;
      componentIds?: number[];
    }
  | {
      pageId: number;
      channelType: "webhook";
      webhookUrl: string;
      name?: string | null;
      channelConfig?: unknown;
      componentIds?: number[];
    };

export async function createSubscription(input: CreateSubscriptionInput) {
  const { pageId, channelType, name, componentIds = [] } = input;

  const pageData = await db.query.page.findFirst({
    where: eq(page.id, pageId),
  });

  if (!pageData) {
    throw new Error("Page not found");
  }

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
      throw new Error("Some components do not belong to this page");
    }
  }

  let emailLower: string | null = null;
  let webhookUrl: string | null = null;
  let channelConfig: string | null = null;

  if (channelType === "email") {
    emailLower = input.email.toLowerCase();

    const duplicate = await db.query.pageSubscriber.findFirst({
      where: and(
        eq(pageSubscriber.pageId, pageId),
        eq(pageSubscriber.email, emailLower),
        eq(pageSubscriber.channelType, "email"),
        isNull(pageSubscriber.unsubscribedAt),
      ),
    });

    if (duplicate) {
      throw new Error(
        "A subscriber with this email already exists for this page.",
      );
    }
  } else {
    webhookUrl = input.webhookUrl;
    await assertSafeUrl(webhookUrl);

    const duplicate = await db.query.pageSubscriber.findFirst({
      where: and(
        eq(pageSubscriber.pageId, pageId),
        eq(pageSubscriber.webhookUrl, webhookUrl),
        eq(pageSubscriber.channelType, "webhook"),
        isNull(pageSubscriber.unsubscribedAt),
      ),
    });

    if (duplicate) {
      throw new Error(
        "A subscriber with this webhook URL already exists for this page.",
      );
    }

    channelConfig = input.channelConfig
      ? JSON.stringify(input.channelConfig)
      : null;
  }

  const token = crypto.randomUUID();
  const now = new Date();

  const subscription = await db.transaction(async (tx) => {
    const sub = await tx
      .insert(pageSubscriber)
      .values({
        channelType,
        email: emailLower,
        webhookUrl,
        channelConfig,
        pageId,
        source: "vendor",
        name: name ?? null,
        token,
        acceptedAt: now,
        expiresAt: null,
      })
      .returning()
      .get();

    if (componentIds.length > 0) {
      await tx
        .insert(pageSubscriberToPageComponent)
        .values(
          componentIds.map((compId) => ({
            pageSubscriberId: sub.id,
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
    channelType: subscription.channelType as "email" | "webhook",
    email: subscription.email ?? undefined,
    webhookUrl: subscription.webhookUrl ?? undefined,
    channelConfig: subscription.channelConfig ?? undefined,
    source: subscription.source as "self_signup" | "vendor",
    name: subscription.name ?? undefined,
    token: subscription.token,
    acceptedAt: subscription.acceptedAt ?? undefined,
    componentIds,
  };
}

/**
 * Update a vendor-added subscription's channel config, name, or component scope.
 *
 * Self-signup rows are subscriber-owned (managed via token) and rejected here.
 * Email rows reject `webhookUrl`/`channelConfig` (no webhook fields to edit).
 * Webhook rows accept URL/headers/name/scope. Email / webhook identity keys
 * (email, webhookUrl) are immutable on email rows; webhook URL is mutable.
 */
export type UpdateChannelInput = {
  subscriberId: number;
  pageId: number;
  name?: string | null;
  webhookUrl?: string;
  channelConfig?: unknown;
  componentIds?: number[];
};

export async function updateChannel(input: UpdateChannelInput) {
  const {
    subscriberId,
    pageId,
    name,
    webhookUrl,
    channelConfig,
    componentIds,
  } = input;

  const existing = await db.query.pageSubscriber.findFirst({
    where: and(
      eq(pageSubscriber.id, subscriberId),
      eq(pageSubscriber.pageId, pageId),
    ),
  });

  if (!existing) {
    throw new Error("Subscriber not found");
  }

  if (existing.source !== "vendor") {
    throw new Error(
      "Self-signup subscribers manage their own subscription; use the unsubscribe action instead.",
    );
  }

  if (existing.channelType === "email") {
    if (webhookUrl !== undefined || channelConfig !== undefined) {
      throw new Error("Email subscribers do not have webhook fields to edit.");
    }
  }

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updateFields.name = name;

  if (existing.channelType === "webhook") {
    if (webhookUrl !== undefined) {
      await assertSafeUrl(webhookUrl);
      updateFields.webhookUrl = webhookUrl;
    }
    if (channelConfig !== undefined) {
      updateFields.channelConfig = channelConfig
        ? JSON.stringify(channelConfig)
        : null;
    }
  }

  if (componentIds !== undefined && componentIds.length > 0) {
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
      throw new Error("Some components do not belong to this page");
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(pageSubscriber)
      .set(updateFields)
      .where(eq(pageSubscriber.id, subscriberId))
      .run();

    if (componentIds !== undefined) {
      await tx
        .delete(pageSubscriberToPageComponent)
        .where(eq(pageSubscriberToPageComponent.pageSubscriberId, subscriberId))
        .run();

      if (componentIds.length > 0) {
        await tx
          .insert(pageSubscriberToPageComponent)
          .values(
            componentIds.map((compId) => ({
              pageSubscriberId: subscriberId,
              pageComponentId: compId,
            })),
          )
          .run();
      }
    }
  });

  return { id: subscriberId };
}

/**
 * Send a test payload to a vendor-added webhook subscriber.
 * Shape is flavor-aware (Slack blocks / Discord embed / generic JSON).
 */
export async function sendTestWebhook(subscriberId: number, pageId: number) {
  const existing = await db.query.pageSubscriber.findFirst({
    where: and(
      eq(pageSubscriber.id, subscriberId),
      eq(pageSubscriber.pageId, pageId),
    ),
  });

  if (!existing) {
    throw new Error("Subscriber not found");
  }

  if (existing.source !== "vendor") {
    throw new Error(
      "Only vendor-added webhook subscribers support test dispatch.",
    );
  }

  if (existing.channelType !== "webhook" || !existing.webhookUrl) {
    throw new Error("Subscriber is not a webhook channel");
  }

  const flavor = detectWebhookFlavor(existing.webhookUrl);
  const headers = parseWebhookHeaders(existing.channelConfig);

  await sendTestWebhookRequest({
    url: existing.webhookUrl,
    flavor,
    headers,
  });
}

function parseWebhookHeaders(
  channelConfig: string | null,
): Record<string, string> {
  if (!channelConfig) return {};
  try {
    const config = JSON.parse(channelConfig) as {
      headers?: { key: string; value: string }[];
    };
    const headers: Record<string, string> = {};
    for (const h of config.headers ?? []) {
      headers[h.key] = h.value;
    }
    return headers;
  } catch {
    return {};
  }
}

/**
 * Unsubscribe by token
 */
export async function unsubscribe(token: string, domain?: string) {
  const subscription = await db.query.pageSubscriber.findFirst({
    where: eq(pageSubscriber.token, token),
    with: {
      page: true,
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (domain) {
    const domainLower = domain.toLowerCase();
    const pageSlugLower = subscription.page.slug.toLowerCase();
    const customDomainLower = subscription.page.customDomain?.toLowerCase();

    if (domainLower !== pageSlugLower && domainLower !== customDomainLower) {
      throw new Error("Subscription not found");
    }
  }

  if (subscription.unsubscribedAt) {
    return;
  }

  await db
    .update(pageSubscriber)
    .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(eq(pageSubscriber.id, subscription.id))
    .run();
}
