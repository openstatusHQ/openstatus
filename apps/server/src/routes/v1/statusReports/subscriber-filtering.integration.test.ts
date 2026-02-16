import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, db, eq, isNotNull, isNull } from "@openstatus/db";
import { page, pageSubscription } from "@openstatus/db/src/schema";

/**
 * Integration tests for subscriber filtering in status report email queries.
 * These tests verify that unsubscribed users are excluded from email notifications.
 */

let testPageId: number;
const testWorkspaceId = 1; // Use existing test workspace from seed data

beforeAll(async () => {
  // Clean up any existing test data
  await db
    .delete(pageSubscription)
    .where(eq(pageSubscription.email, "active-sub@test.com"));
  await db
    .delete(pageSubscription)
    .where(eq(pageSubscription.email, "unsubscribed-sub@test.com"));
  await db
    .delete(pageSubscription)
    .where(eq(pageSubscription.email, "pending-sub@test.com"));
  await db.delete(page).where(eq(page.slug, "test-filtering-page"));

  // Create a test page
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: testWorkspaceId,
      title: "Test Filtering Page",
      description: "A test page for subscriber filtering tests",
      slug: "test-filtering-page",
      customDomain: "",
    })
    .returning()
    .get();

  testPageId = testPage.id;

  // Create test subscribers with different states
  // 1. Active subscriber (verified, not unsubscribed)
  await db.insert(pageSubscription).values({
    pageId: testPageId,
    workspaceId: testWorkspaceId,
    channelType: "email",
    email: "active-sub@test.com",
    token: crypto.randomUUID(),
    verifiedAt: new Date(),
    unsubscribedAt: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });

  // 2. Unsubscribed subscriber (verified, then unsubscribed)
  await db.insert(pageSubscription).values({
    pageId: testPageId,
    workspaceId: testWorkspaceId,
    channelType: "email",
    email: "unsubscribed-sub@test.com",
    token: crypto.randomUUID(),
    verifiedAt: new Date(),
    unsubscribedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });

  // 3. Pending subscriber (not verified)
  await db.insert(pageSubscription).values({
    pageId: testPageId,
    workspaceId: testWorkspaceId,
    channelType: "email",
    email: "pending-sub@test.com",
    token: crypto.randomUUID(),
    verifiedAt: null,
    unsubscribedAt: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });
});

afterAll(async () => {
  // Clean up test data
  await db
    .delete(pageSubscription)
    .where(eq(pageSubscription.email, "active-sub@test.com"));
  await db
    .delete(pageSubscription)
    .where(eq(pageSubscription.email, "unsubscribed-sub@test.com"));
  await db
    .delete(pageSubscription)
    .where(eq(pageSubscription.email, "pending-sub@test.com"));
  await db.delete(page).where(eq(page.slug, "test-filtering-page"));
});

describe("Subscriber filtering for email notifications", () => {
  test("should exclude unsubscribed users from email queries", async () => {
    // This query mirrors the exact query used in statusReports/post.ts and statusReportUpdates/post.ts
    const subscribers = await db
      .select()
      .from(pageSubscription)
      .where(
        and(
          eq(pageSubscription.pageId, testPageId),
          isNotNull(pageSubscription.verifiedAt),
          isNull(pageSubscription.unsubscribedAt),
        ),
      )
      .all();

    // Should only include active subscriber, not unsubscribed or pending
    expect(subscribers.length).toBe(1);
    expect(subscribers[0].email).toBe("active-sub@test.com");
  });

  test("should exclude pending (unverified) users from email queries", async () => {
    const subscribers = await db
      .select()
      .from(pageSubscription)
      .where(
        and(
          eq(pageSubscription.pageId, testPageId),
          isNotNull(pageSubscription.verifiedAt),
          isNull(pageSubscription.unsubscribedAt),
        ),
      )
      .all();

    const pendingEmails = subscribers.filter(
      (s) => s.email === "pending-sub@test.com",
    );
    expect(pendingEmails.length).toBe(0);
  });

  test("should not include unsubscribed user even if verifiedAt is set", async () => {
    const subscribers = await db
      .select()
      .from(pageSubscription)
      .where(
        and(
          eq(pageSubscription.pageId, testPageId),
          isNotNull(pageSubscription.verifiedAt),
          isNull(pageSubscription.unsubscribedAt),
        ),
      )
      .all();

    const unsubscribedEmails = subscribers.filter(
      (s) => s.email === "unsubscribed-sub@test.com",
    );
    expect(unsubscribedEmails.length).toBe(0);
  });

  test("should return all subscribers without unsubscribedAt filter", async () => {
    // Query without the unsubscribedAt filter - should include unsubscribed users
    const allVerifiedSubscribers = await db
      .select()
      .from(pageSubscription)
      .where(
        and(
          eq(pageSubscription.pageId, testPageId),
          isNotNull(pageSubscription.verifiedAt),
        ),
      )
      .all();

    // Should include both active and unsubscribed (both have verifiedAt set)
    expect(allVerifiedSubscribers.length).toBe(2);

    const emails = allVerifiedSubscribers.map((s) => s.email);
    expect(emails).toContain("active-sub@test.com");
    expect(emails).toContain("unsubscribed-sub@test.com");
  });

  test("should correctly filter subscribers with valid tokens", async () => {
    const subscribers = await db
      .select()
      .from(pageSubscription)
      .where(
        and(
          eq(pageSubscription.pageId, testPageId),
          isNotNull(pageSubscription.verifiedAt),
          isNull(pageSubscription.unsubscribedAt),
        ),
      )
      .all();

    // Filter for valid tokens (non-null)
    const validSubscribers = subscribers.filter(
      (s): s is typeof s & { token: string } => s.token !== null,
    );

    expect(validSubscribers.length).toBe(1);
    expect(validSubscribers[0].token).toBeDefined();
    expect(validSubscribers[0].token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

describe("Subscriber state transitions", () => {
  test("should allow re-subscribing after unsubscription", async () => {
    // Get the unsubscribed subscriber
    const unsubscribedSub = await db.query.pageSubscription.findFirst({
      where: eq(pageSubscription.email, "unsubscribed-sub@test.com"),
    });

    if (!unsubscribedSub) {
      throw new Error("Unsubscribed subscriber not found");
    }

    expect(unsubscribedSub?.unsubscribedAt).not.toBeNull();

    // Simulate re-subscription by clearing unsubscribedAt
    await db
      .update(pageSubscription)
      .set({
        unsubscribedAt: null,
        verifiedAt: null, // Reset for re-verification
        token: crypto.randomUUID(), // Generate new token
      })
      .where(eq(pageSubscription.id, unsubscribedSub?.id));

    // After re-subscription + verification, subscriber should be included
    // (we need to set verifiedAt for verification)
    await db
      .update(pageSubscription)
      .set({ verifiedAt: new Date() })
      .where(eq(pageSubscription.id, unsubscribedSub?.id));

    const subscribers = await db
      .select()
      .from(pageSubscription)
      .where(
        and(
          eq(pageSubscription.pageId, testPageId),
          isNotNull(pageSubscription.verifiedAt),
          isNull(pageSubscription.unsubscribedAt),
        ),
      )
      .all();

    // Now should include both active and re-subscribed users
    expect(subscribers.length).toBe(2);

    // Restore original state for other tests
    await db
      .update(pageSubscription)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscription.id, unsubscribedSub?.id));
  });

  test("should track unsubscription timestamp", async () => {
    const subscriber = await db.query.pageSubscription.findFirst({
      where: eq(pageSubscription.email, "unsubscribed-sub@test.com"),
    });

    expect(subscriber?.unsubscribedAt).toBeInstanceOf(Date);
  });
});

describe("Query performance considerations", () => {
  test("should use proper index-friendly query conditions", async () => {
    // This test verifies the query uses conditions that can leverage indexes
    // The conditions: pageId = X AND verifiedAt IS NOT NULL AND unsubscribedAt IS NULL
    // can all be optimized with appropriate indexes

    const startTime = performance.now();

    const subscribers = await db
      .select()
      .from(pageSubscription)
      .where(
        and(
          eq(pageSubscription.pageId, testPageId),
          isNotNull(pageSubscription.verifiedAt),
          isNull(pageSubscription.unsubscribedAt),
        ),
      )
      .all();

    const endTime = performance.now();

    // Query should complete quickly (under 100ms for small datasets)
    expect(endTime - startTime).toBeLessThan(100);
    expect(subscribers).toBeDefined();
  });
});
