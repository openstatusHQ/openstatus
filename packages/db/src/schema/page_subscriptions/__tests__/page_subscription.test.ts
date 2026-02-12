import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { db, eq } from "../../..";
import { page } from "../../pages";
import { workspace } from "../../workspaces";
import { pageSubscription } from "../page_subscription";

// Test data setup
let testWorkspaceId: number;
let testPageId: number;

beforeAll(async () => {
  // Create a test workspace
  const testWorkspace = await db
    .insert(workspace)
    .values({
      slug: "test-subscription-workspace",
      name: "Test Subscription Workspace",
      stripeId: "test_stripe_id",
    })
    .returning()
    .get();

  testWorkspaceId = testWorkspace.id;

  // Create a test page
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: testWorkspaceId,
      title: "Test Subscription Page",
      description: "A test page for subscription tests",
      slug: "test-subscription-page",
      customDomain: "",
    })
    .returning()
    .get();

  testPageId = testPage.id;
});

afterAll(async () => {
  // Clean up test data
  await db
    .delete(pageSubscription)
    .where(eq(pageSubscription.pageId, testPageId));
  await db.delete(page).where(eq(page.id, testPageId));
  await db.delete(workspace).where(eq(workspace.id, testWorkspaceId));
});

describe("page_subscription CHECK constraint validation", () => {
  test("should reject email channel with NULL email", async () => {
    expect(async () => {
      await db
        .insert(pageSubscription)
        .values({
          channelType: "email",
          email: null,
          webhookUrl: null,
          pageId: testPageId,
          workspaceId: testWorkspaceId,
          token: crypto.randomUUID(),
        })
        .returning()
        .get();
    }).toThrow();
  });

  test("should reject email channel with both identifiers populated", async () => {
    expect(async () => {
      await db
        .insert(pageSubscription)
        .values({
          channelType: "email",
          email: "user@example.com",
          webhookUrl: "https://example.com/webhook",
          pageId: testPageId,
          workspaceId: testWorkspaceId,
          token: crypto.randomUUID(),
        })
        .returning()
        .get();
    }).toThrow();
  });

  test("should accept email channel with only email populated", async () => {
    const token = crypto.randomUUID();
    const result = await db
      .insert(pageSubscription)
      .values({
        channelType: "email",
        email: "user@example.com",
        webhookUrl: null,
        pageId: testPageId,
        workspaceId: testWorkspaceId,
        token,
      })
      .returning()
      .get();

    expect(result.email).toBe("user@example.com");
    expect(result.webhookUrl).toBeNull();
    expect(result.channelType).toBe("email");

    // Clean up
    await db.delete(pageSubscription).where(eq(pageSubscription.token, token));
  });

  test("should accept webhook channel with only webhook_url populated", async () => {
    const token = crypto.randomUUID();
    const result = await db
      .insert(pageSubscription)
      .values({
        channelType: "webhook",
        email: null,
        webhookUrl: "https://example.com/webhook",
        pageId: testPageId,
        workspaceId: testWorkspaceId,
        token,
      })
      .returning()
      .get();

    expect(result.webhookUrl).toBe("https://example.com/webhook");
    expect(result.email).toBeNull();
    expect(result.channelType).toBe("webhook");

    // Clean up
    await db.delete(pageSubscription).where(eq(pageSubscription.token, token));
  });

  test("should reject webhook channel with NULL webhook_url", async () => {
    expect(async () => {
      await db
        .insert(pageSubscription)
        .values({
          channelType: "webhook",
          email: null,
          webhookUrl: null,
          pageId: testPageId,
          workspaceId: testWorkspaceId,
          token: crypto.randomUUID(),
        })
        .returning()
        .get();
    }).toThrow();
  });

  test("should reject mismatched channel type and identifier (webhook type with email)", async () => {
    expect(async () => {
      await db
        .insert(pageSubscription)
        .values({
          channelType: "webhook",
          email: "user@example.com",
          webhookUrl: null,
          pageId: testPageId,
          workspaceId: testWorkspaceId,
          token: crypto.randomUUID(),
        })
        .returning()
        .get();
    }).toThrow();
  });

  test("should reject mismatched channel type and identifier (email type with webhook_url)", async () => {
    expect(async () => {
      await db
        .insert(pageSubscription)
        .values({
          channelType: "email",
          email: null,
          webhookUrl: "https://example.com/webhook",
          pageId: testPageId,
          workspaceId: testWorkspaceId,
          token: crypto.randomUUID(),
        })
        .returning()
        .get();
    }).toThrow();
  });
});

describe("page_subscription UNIQUE constraints", () => {
  test("should prevent duplicate email subscriptions for same page", async () => {
    const email = "duplicate@example.com";
    const token1 = crypto.randomUUID();

    // First subscription should succeed
    await db
      .insert(pageSubscription)
      .values({
        channelType: "email",
        email,
        webhookUrl: null,
        pageId: testPageId,
        workspaceId: testWorkspaceId,
        token: token1,
        verifiedAt: new Date(),
      })
      .returning()
      .get();

    // Second subscription with same email and page should fail
    expect(async () => {
      await db
        .insert(pageSubscription)
        .values({
          channelType: "email",
          email,
          webhookUrl: null,
          pageId: testPageId,
          workspaceId: testWorkspaceId,
          token: crypto.randomUUID(),
          verifiedAt: new Date(),
        })
        .returning()
        .get();
    }).toThrow();

    // Clean up
    await db.delete(pageSubscription).where(eq(pageSubscription.token, token1));
  });

  test("should allow same email for different pages", async () => {
    const email = "multi-page@example.com";

    // Create another test page
    const testPage2 = await db
      .insert(page)
      .values({
        workspaceId: testWorkspaceId,
        title: "Test Subscription Page 2",
        description: "Another test page",
        slug: "test-subscription-page-2",
        customDomain: "",
      })
      .returning()
      .get();

    const token1 = crypto.randomUUID();
    const token2 = crypto.randomUUID();

    // Same email, different pages - both should succeed
    await db
      .insert(pageSubscription)
      .values({
        channelType: "email",
        email,
        webhookUrl: null,
        pageId: testPageId,
        workspaceId: testWorkspaceId,
        token: token1,
        verifiedAt: new Date(),
      })
      .returning()
      .get();

    await db
      .insert(pageSubscription)
      .values({
        channelType: "email",
        email,
        webhookUrl: null,
        pageId: testPage2.id,
        workspaceId: testWorkspaceId,
        token: token2,
        verifiedAt: new Date(),
      })
      .returning()
      .get();

    // Clean up
    await db.delete(pageSubscription).where(eq(pageSubscription.token, token1));
    await db.delete(pageSubscription).where(eq(pageSubscription.token, token2));
    await db.delete(page).where(eq(page.id, testPage2.id));
  });

  test("should enforce case-insensitive email uniqueness", async () => {
    const token1 = crypto.randomUUID();

    // First subscription with lowercase email
    await db
      .insert(pageSubscription)
      .values({
        channelType: "email",
        email: "case@example.com",
        webhookUrl: null,
        pageId: testPageId,
        workspaceId: testWorkspaceId,
        token: token1,
        verifiedAt: new Date(),
      })
      .returning()
      .get();

    // Second subscription with uppercase email should fail
    expect(async () => {
      await db
        .insert(pageSubscription)
        .values({
          channelType: "email",
          email: "CASE@example.com",
          webhookUrl: null,
          pageId: testPageId,
          workspaceId: testWorkspaceId,
          token: crypto.randomUUID(),
          verifiedAt: new Date(),
        })
        .returning()
        .get();
    }).toThrow();

    // Clean up
    await db.delete(pageSubscription).where(eq(pageSubscription.token, token1));
  });

  test("should allow unsubscribed email to re-subscribe", async () => {
    const email = "resubscribe@example.com";
    const token1 = crypto.randomUUID();
    const token2 = crypto.randomUUID();

    // First subscription
    await db
      .insert(pageSubscription)
      .values({
        channelType: "email",
        email,
        webhookUrl: null,
        pageId: testPageId,
        workspaceId: testWorkspaceId,
        token: token1,
        verifiedAt: new Date(),
      })
      .returning()
      .get();

    // Unsubscribe
    await db
      .update(pageSubscription)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscription.token, token1));

    // Re-subscribe should succeed (because unsubscribedAt is NOT NULL)
    await db
      .insert(pageSubscription)
      .values({
        channelType: "email",
        email,
        webhookUrl: null,
        pageId: testPageId,
        workspaceId: testWorkspaceId,
        token: token2,
        verifiedAt: new Date(),
      })
      .returning()
      .get();

    // Clean up
    await db.delete(pageSubscription).where(eq(pageSubscription.token, token1));
    await db.delete(pageSubscription).where(eq(pageSubscription.token, token2));
  });

  test("should prevent duplicate webhook subscriptions for same page", async () => {
    const webhookUrl = "https://example.com/webhook-duplicate";
    const token1 = crypto.randomUUID();

    // First subscription should succeed
    await db
      .insert(pageSubscription)
      .values({
        channelType: "webhook",
        email: null,
        webhookUrl,
        pageId: testPageId,
        workspaceId: testWorkspaceId,
        token: token1,
        verifiedAt: new Date(),
      })
      .returning()
      .get();

    // Second subscription with same webhook URL and page should fail
    expect(async () => {
      await db
        .insert(pageSubscription)
        .values({
          channelType: "webhook",
          email: null,
          webhookUrl,
          pageId: testPageId,
          workspaceId: testWorkspaceId,
          token: crypto.randomUUID(),
          verifiedAt: new Date(),
        })
        .returning()
        .get();
    }).toThrow();

    // Clean up
    await db.delete(pageSubscription).where(eq(pageSubscription.token, token1));
  });
});

describe("page_subscription relations", () => {
  test("should cascade delete subscriptions when page is deleted", async () => {
    // Create a temporary page
    const tempPage = await db
      .insert(page)
      .values({
        workspaceId: testWorkspaceId,
        title: "Temp Page",
        description: "Temporary page",
        slug: "temp-cascade-page",
        customDomain: "",
      })
      .returning()
      .get();

    const token = crypto.randomUUID();

    // Create subscription for this page
    await db
      .insert(pageSubscription)
      .values({
        channelType: "email",
        email: "cascade@example.com",
        webhookUrl: null,
        pageId: tempPage.id,
        workspaceId: testWorkspaceId,
        token,
        verifiedAt: new Date(),
      })
      .returning()
      .get();

    // Delete the page
    await db.delete(page).where(eq(page.id, tempPage.id));

    // Subscription should be deleted
    const subscription = await db.query.pageSubscription.findFirst({
      where: eq(pageSubscription.token, token),
    });

    expect(subscription).toBeUndefined();
  });
});
