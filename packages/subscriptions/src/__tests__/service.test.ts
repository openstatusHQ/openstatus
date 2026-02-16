import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { db, eq } from "@openstatus/db";
import {
  page,
  pageComponent,
  pageSubscription,
  workspace,
} from "@openstatus/db/src/schema";
import {
  getSubscriptionByToken,
  unsubscribe,
  updateSubscriptionScope,
  upsertEmailSubscription,
  verifySubscription,
} from "../service";

// Test data setup
let testWorkspaceId: number;
let testPageId: number;
let testComponent1Id: number;
let testComponent2Id: number;

beforeAll(async () => {
  // Create test workspace
  const testWorkspace = await db
    .insert(workspace)
    .values({
      slug: "test-subscription-service",
      name: "Test Subscription Service",
      stripeId: "test_stripe_service",
    })
    .returning()
    .get();

  testWorkspaceId = testWorkspace.id;

  // Create test page
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: testWorkspaceId,
      title: "Test Service Page",
      description: "Test page for service tests",
      slug: "test-service-page",
      customDomain: "",
    })
    .returning()
    .get();

  testPageId = testPage.id;

  // Create test components
  const component1 = await db
    .insert(pageComponent)
    .values({
      pageId: testPageId,
      workspaceId: testWorkspaceId,
      type: "static",
      name: "API v1",
      description: "API v1 component",
      order: 1,
    })
    .returning()
    .get();

  const component2 = await db
    .insert(pageComponent)
    .values({
      pageId: testPageId,
      workspaceId: testWorkspaceId,
      type: "static",
      name: "API v2",
      description: "API v2 component",
      order: 2,
    })
    .returning()
    .get();

  testComponent1Id = component1.id;
  testComponent2Id = component2.id;
});

afterAll(async () => {
  // Clean up
  await db
    .delete(pageSubscription)
    .where(eq(pageSubscription.pageId, testPageId));
  await db.delete(pageComponent).where(eq(pageComponent.pageId, testPageId));
  await db.delete(page).where(eq(page.id, testPageId));
  await db.delete(workspace).where(eq(workspace.id, testWorkspaceId));
});

describe("upsertEmailSubscription", () => {
  test("should create new subscription for entire page", async () => {
    const result = await upsertEmailSubscription({
      email: "test@example.com",
      pageId: testPageId,
    });

    expect(result.email).toBe("test@example.com");
    expect(result.pageId).toBe(testPageId);
    expect(result.componentIds).toEqual([]);
    expect(result.verifiedAt).toBeUndefined();

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, result.id));
  });

  test("should create subscription with specific components", async () => {
    const result = await upsertEmailSubscription({
      email: "component@example.com",
      pageId: testPageId,
      componentIds: [testComponent1Id, testComponent2Id],
    });

    expect(result.componentIds).toHaveLength(2);
    expect(result.componentIds).toContain(testComponent1Id);
    expect(result.componentIds).toContain(testComponent2Id);

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, result.id));
  });

  test("should merge components when re-subscribing", async () => {
    // First subscription
    const first = await upsertEmailSubscription({
      email: "merge@example.com",
      pageId: testPageId,
      componentIds: [testComponent1Id],
    });

    expect(first.componentIds).toEqual([testComponent1Id]);

    // Re-subscribe with different component
    const second = await upsertEmailSubscription({
      email: "merge@example.com",
      pageId: testPageId,
      componentIds: [testComponent2Id],
    });

    // Should be same subscription ID
    expect(second.id).toBe(first.id);
    // Should have merged components
    expect(second.componentIds).toHaveLength(2);
    expect(second.componentIds).toContain(testComponent1Id);
    expect(second.componentIds).toContain(testComponent2Id);

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, first.id));
  });

  test("should reject invalid component IDs", async () => {
    expect(async () => {
      await upsertEmailSubscription({
        email: "invalid@example.com",
        pageId: testPageId,
        componentIds: [99999], // Non-existent component
      });
    }).toThrow("Invalid components");
  });
});

describe("verifySubscription", () => {
  test("should verify subscription by token", async () => {
    // Create unverified subscription
    const sub = await upsertEmailSubscription({
      email: "verify@example.com",
      pageId: testPageId,
    });

    expect(sub.verifiedAt).toBeUndefined();

    // Verify
    const verified = await verifySubscription(sub.token);

    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(sub.id);
    expect(verified?.verifiedAt).toBeDefined();

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });

  test("should return null for invalid token", async () => {
    const result = await verifySubscription("invalid-token");
    expect(result).toBeNull();
  });

  test("should verify subscription with correct domain (slug)", async () => {
    const sub = await upsertEmailSubscription({
      email: "verify-domain@example.com",
      pageId: testPageId,
    });

    // Verify with matching slug
    const verified = await verifySubscription(sub.token, "test-service-page");

    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(sub.id);
    expect(verified?.verifiedAt).toBeDefined();

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });

  test("should return null when domain doesn't match", async () => {
    const sub = await upsertEmailSubscription({
      email: "verify-wrong-domain@example.com",
      pageId: testPageId,
    });

    // Verify with non-matching domain
    const result = await verifySubscription(sub.token, "wrong-domain");

    expect(result).toBeNull();

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });
});

describe("updateSubscriptionScope", () => {
  test("should replace subscription scope", async () => {
    // Create subscription with component 1
    const sub = await upsertEmailSubscription({
      email: "update@example.com",
      pageId: testPageId,
      componentIds: [testComponent1Id],
    });

    // Verify first
    await verifySubscription(sub.token);

    // Replace with component 2
    const updated = await updateSubscriptionScope({
      token: sub.token,
      componentIds: [testComponent2Id],
    });

    expect(updated.componentIds).toEqual([testComponent2Id]);

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });

  test("should replace with multiple components", async () => {
    // Create subscription with component 1
    const sub = await upsertEmailSubscription({
      email: "replace-multi@example.com",
      pageId: testPageId,
      componentIds: [testComponent1Id],
    });

    await verifySubscription(sub.token);

    // Replace with both components
    const updated = await updateSubscriptionScope({
      token: sub.token,
      componentIds: [testComponent1Id, testComponent2Id],
    });

    expect(updated.componentIds).toHaveLength(2);
    expect(updated.componentIds).toContain(testComponent1Id);
    expect(updated.componentIds).toContain(testComponent2Id);

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });

  test("should replace with empty array (entire page)", async () => {
    // Create subscription with both components
    const sub = await upsertEmailSubscription({
      email: "replace-empty@example.com",
      pageId: testPageId,
      componentIds: [testComponent1Id, testComponent2Id],
    });

    await verifySubscription(sub.token);

    // Replace with empty array (subscribe to entire page)
    const updated = await updateSubscriptionScope({
      token: sub.token,
      componentIds: [],
    });

    expect(updated.componentIds).toEqual([]);

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });
});

describe("getSubscriptionByToken", () => {
  test("should get subscription by token with masked email", async () => {
    const sub = await upsertEmailSubscription({
      email: "get@example.com",
      pageId: testPageId,
    });

    const result = await getSubscriptionByToken(sub.token);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(sub.id);
    // Email should be masked for privacy (first char + *** + @domain)
    expect(result?.email).toBe("g***@example.com");

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });

  test("should get subscription with correct domain validation and masked email", async () => {
    const sub = await upsertEmailSubscription({
      email: "get-domain@example.com",
      pageId: testPageId,
    });

    const result = await getSubscriptionByToken(sub.token, "test-service-page");

    expect(result).not.toBeNull();
    expect(result?.id).toBe(sub.id);
    // Email should be masked for privacy
    expect(result?.email).toBe("g***@example.com");

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });

  test("should return null when domain doesn't match", async () => {
    const sub = await upsertEmailSubscription({
      email: "get-wrong-domain@example.com",
      pageId: testPageId,
    });

    const result = await getSubscriptionByToken(sub.token, "wrong-domain");

    expect(result).toBeNull();

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });

  test("should mask emails correctly for various formats", async () => {
    // Test single character email
    const sub1 = await upsertEmailSubscription({
      email: "a@example.com",
      pageId: testPageId,
    });
    const result1 = await getSubscriptionByToken(sub1.token);
    expect(result1?.email).toBe("a***@example.com");

    // Test longer email
    const sub2 = await upsertEmailSubscription({
      email: "john.doe@example.com",
      pageId: testPageId,
    });
    const result2 = await getSubscriptionByToken(sub2.token);
    expect(result2?.email).toBe("j***@example.com");

    // Test email with subdomain
    const sub3 = await upsertEmailSubscription({
      email: "user@subdomain.example.co.uk",
      pageId: testPageId,
    });
    const result3 = await getSubscriptionByToken(sub3.token);
    expect(result3?.email).toBe("u***@subdomain.example.co.uk");

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub1.id));
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub2.id));
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub3.id));
  });
});

describe("unsubscribe", () => {
  test("should unsubscribe by token", async () => {
    // Create and verify subscription
    const sub = await upsertEmailSubscription({
      email: "unsubscribe@example.com",
      pageId: testPageId,
    });

    await verifySubscription(sub.token);

    // Unsubscribe
    await unsubscribe(sub.token);

    // Check it's unsubscribed
    const result = await getSubscriptionByToken(sub.token);
    expect(result).not.toBeNull();
    expect(result?.unsubscribedAt).toBeDefined();

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });

  test("should throw error for invalid token", async () => {
    expect(async () => {
      await unsubscribe("invalid-token");
    }).toThrow("Subscription not found");
  });

  test("should unsubscribe with correct domain validation", async () => {
    const sub = await upsertEmailSubscription({
      email: "unsubscribe-domain@example.com",
      pageId: testPageId,
    });

    await verifySubscription(sub.token);

    // Unsubscribe with matching domain
    await unsubscribe(sub.token, "test-service-page");

    // Check it's unsubscribed
    const result = await getSubscriptionByToken(sub.token);
    expect(result).not.toBeNull();
    expect(result?.unsubscribedAt).toBeDefined();

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });

  test("should throw error when domain doesn't match", async () => {
    const sub = await upsertEmailSubscription({
      email: "unsubscribe-wrong-domain@example.com",
      pageId: testPageId,
    });

    await verifySubscription(sub.token);

    // Try to unsubscribe with wrong domain
    expect(async () => {
      await unsubscribe(sub.token, "wrong-domain");
    }).toThrow("Subscription not found");

    // Cleanup
    await db.delete(pageSubscription).where(eq(pageSubscription.id, sub.id));
  });
});
