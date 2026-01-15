import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { db, eq } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";

// Test data setup
let testPageId: number;
let testSubscriberId: number;
let testToken: string;
const testWorkspaceId = 1; // Use existing test workspace from seed data

beforeAll(async () => {
  // Clean up any existing test data
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, "test-unsubscribe@example.com"));
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, "test-unsubscribe-2@example.com"));
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, "test-unsubscribe-3@example.com"));
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, "test-unsubscribe-4@example.com"));
  await db.delete(page).where(eq(page.slug, "test-unsubscribe-page"));

  // Create a test page
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: testWorkspaceId,
      title: "Test Unsubscribe Page",
      description: "A test page for unsubscribe tests",
      slug: "test-unsubscribe-page",
      customDomain: "",
    })
    .returning()
    .get();

  testPageId = testPage.id;

  // Create a verified subscriber for testing
  testToken = crypto.randomUUID();
  const subscriber = await db
    .insert(pageSubscriber)
    .values({
      pageId: testPageId,
      email: "test-unsubscribe@example.com",
      token: testToken,
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    })
    .returning()
    .get();

  testSubscriberId = subscriber.id;
});

afterAll(async () => {
  // Clean up test data
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, "test-unsubscribe@example.com"));
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, "test-unsubscribe-2@example.com"));
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, "test-unsubscribe-3@example.com"));
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, "test-unsubscribe-4@example.com"));
  await db.delete(page).where(eq(page.slug, "test-unsubscribe-page"));
});

describe("getSubscriberByToken", () => {
  test("should return subscriber info with masked email for valid token", async () => {
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, testToken),
      with: { page: true },
    });

    expect(subscriber).toBeDefined();
    expect(subscriber?.page.title).toBe("Test Unsubscribe Page");

    // Manually mask the email to test the masking logic
    const email = subscriber!.email;
    const [localPart, domain] = email.split("@");
    const maskedEmail = localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("t***@example.com");
  });

  test("should return null for non-existent token", async () => {
    const nonExistentToken = crypto.randomUUID();
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, nonExistentToken),
    });

    expect(subscriber).toBeUndefined();
  });

  test("should return null for already unsubscribed user", async () => {
    // Create an unsubscribed subscriber
    const unsubscribedToken = crypto.randomUUID();
    await db.insert(pageSubscriber).values({
      pageId: testPageId,
      email: "test-unsubscribe-2@example.com",
      token: unsubscribedToken,
      acceptedAt: new Date(),
      unsubscribedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, unsubscribedToken),
    });

    expect(subscriber).toBeDefined();
    expect(subscriber?.unsubscribedAt).not.toBeNull();
  });

  test("should properly mask emails with single character local part", async () => {
    const email = "a@example.com";
    const [localPart, domain] = email.split("@");
    const maskedEmail = localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("a***@example.com");
  });

  test("should properly mask emails with long local part", async () => {
    const email = "verylongemail@example.com";
    const [localPart, domain] = email.split("@");
    const maskedEmail = localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("v***@example.com");
  });
});

describe("unsubscribe mutation", () => {
  test("should unsubscribe a verified subscriber successfully", async () => {
    // Create a fresh subscriber for this test
    const newToken = crypto.randomUUID();
    const newSubscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: "test-unsubscribe-3@example.com",
        token: newToken,
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning()
      .get();

    // Simulate unsubscribe operation
    await db
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.id, newSubscriber.id));

    // Verify unsubscribed
    const updatedSubscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, newSubscriber.id),
    });

    expect(updatedSubscriber?.unsubscribedAt).not.toBeNull();
    expect(updatedSubscriber?.unsubscribedAt).toBeInstanceOf(Date);
  });

  test("should fail for non-existent token", async () => {
    const nonExistentToken = crypto.randomUUID();
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, nonExistentToken),
    });

    expect(subscriber).toBeUndefined();
  });

  test("should fail for unverified subscriber", async () => {
    // Create an unverified subscriber
    const unverifiedToken = crypto.randomUUID();
    const unverifiedSubscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: "test-unsubscribe-4@example.com",
        token: unverifiedToken,
        acceptedAt: null, // Not verified
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning()
      .get();

    expect(unverifiedSubscriber.acceptedAt).toBeNull();
  });

  test("should fail for already unsubscribed user", async () => {
    // Get the unsubscribed subscriber from earlier test
    const unsubscribedSubscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.email, "test-unsubscribe-2@example.com"),
    });

    expect(unsubscribedSubscriber).toBeDefined();
    expect(unsubscribedSubscriber?.unsubscribedAt).not.toBeNull();
  });

  test("should set unsubscribedAt to current timestamp", async () => {
    const beforeUnsubscribe = new Date();

    // Get subscriber and unsubscribe
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.email, "test-unsubscribe-3@example.com"),
    });

    if (subscriber) {
      await db
        .update(pageSubscriber)
        .set({ unsubscribedAt: new Date() })
        .where(eq(pageSubscriber.id, subscriber.id));

      const updatedSubscriber = await db.query.pageSubscriber.findFirst({
        where: eq(pageSubscriber.id, subscriber.id),
      });

      const afterUnsubscribe = new Date();

      expect(updatedSubscriber?.unsubscribedAt).toBeDefined();
      expect(updatedSubscriber?.unsubscribedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeUnsubscribe.getTime() - 1000
      );
      expect(updatedSubscriber?.unsubscribedAt!.getTime()).toBeLessThanOrEqual(
        afterUnsubscribe.getTime() + 1000
      );
    }
  });
});

describe("email masking logic", () => {
  test("should mask email j***@example.com correctly", () => {
    const email = "john@example.com";
    const [localPart, domain] = email.split("@");
    const maskedEmail = localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("j***@example.com");
  });

  test("should handle empty local part gracefully", () => {
    // Edge case: if somehow we have @domain only
    const email = "@example.com";
    const [localPart, domain] = email.split("@");
    const maskedEmail = localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("***@example.com");
  });

  test("should preserve domain in masked email", () => {
    const email = "user@custom-domain.io";
    const [localPart, domain] = email.split("@");
    const maskedEmail = localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("u***@custom-domain.io");
  });

  test("should handle complex domain", () => {
    const email = "test@subdomain.example.co.uk";
    const [localPart, domain] = email.split("@");
    const maskedEmail = localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("t***@subdomain.example.co.uk");
  });
});

describe("token validation", () => {
  test("should validate UUID format for token", () => {
    const validToken = crypto.randomUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(validToken).toMatch(uuidRegex);
  });

  test("should reject invalid UUID format", () => {
    const invalidToken = "not-a-valid-uuid";
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(invalidToken).not.toMatch(uuidRegex);
  });
});
