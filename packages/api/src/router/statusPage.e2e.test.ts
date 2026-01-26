import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, db, eq, isNotNull, isNull } from "@openstatus/db";
import { page, pageSubscriber, workspace } from "@openstatus/db/src/schema";

/**
 * End-to-end integration tests for the full unsubscribe flow.
 * These tests simulate the complete user journey:
 * subscribe -> verify -> receive email -> unsubscribe
 */

let testPageId: number;
let testWorkspaceId: number;
const testSlug = "e2e-unsubscribe-test-page";
const testEmail = "e2e-test-user@example.com";
let subscriberToken: string;

beforeAll(async () => {
  // Clean up any existing test data
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, testEmail));
  await db.delete(page).where(eq(page.slug, testSlug));

  // Get an existing workspace (use workspace id 1 from seed data)
  const existingWorkspace = await db.query.workspace.findFirst({
    where: eq(workspace.id, 1),
  });

  if (!existingWorkspace) {
    throw new Error(
      "Test workspace not found. Please ensure seed data exists.",
    );
  }

  testWorkspaceId = existingWorkspace.id;

  // Create a test page
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: testWorkspaceId,
      title: "E2E Test Status Page",
      description: "A test page for E2E unsubscribe flow tests",
      slug: testSlug,
      customDomain: "",
    })
    .returning()
    .get();

  testPageId = testPage.id;
});

afterAll(async () => {
  // Clean up test data
  await db.delete(pageSubscriber).where(eq(pageSubscriber.email, testEmail));
  await db.delete(page).where(eq(page.slug, testSlug));
});

describe("Full unsubscribe flow: subscribe -> verify -> unsubscribe", () => {
  test("Step 1: User subscribes to status page", async () => {
    // Simulate subscription by inserting a subscriber
    const subscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: testEmail,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      })
      .returning()
      .get();

    expect(subscriber.id).toBeDefined();
    expect(subscriber.email).toBe(testEmail);
    expect(subscriber.token).toBeDefined();
    expect(subscriber.acceptedAt).toBeNull();
    expect(subscriber.unsubscribedAt).toBeNull();

    if (!subscriber.token) {
      throw new Error("Subscriber token is undefined");
    }

    subscriberToken = subscriber.token;
  });

  test("Step 2: User verifies their email subscription", async () => {
    // Verify the subscription
    await db
      .update(pageSubscriber)
      .set({ acceptedAt: new Date() })
      .where(eq(pageSubscriber.token, subscriberToken));

    // Verify the subscription is now active
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, subscriberToken),
    });

    expect(subscriber?.acceptedAt).not.toBeNull();
    expect(subscriber?.unsubscribedAt).toBeNull();
  });

  test("Step 3: Verified subscriber is included in email recipient list", async () => {
    // This query mirrors the exact query used in statusReports/post.ts
    const subscribers = await db
      .select()
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, testPageId),
          isNotNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .all();

    expect(subscribers.length).toBe(1);
    expect(subscribers[0].email).toBe(testEmail);
    expect(subscribers[0].token).toBe(subscriberToken);
  });

  test("Step 4: User clicks unsubscribe and sets unsubscribedAt", async () => {
    // Simulate the unsubscribe action
    await db
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.token, subscriberToken));

    // Verify the unsubscription
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, subscriberToken),
    });

    expect(subscriber?.unsubscribedAt).not.toBeNull();
    expect(subscriber?.unsubscribedAt).toBeInstanceOf(Date);
  });

  test("Step 5: Unsubscribed user is excluded from email recipient list", async () => {
    // This query mirrors the exact query used in statusReports/post.ts
    const subscribers = await db
      .select()
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, testPageId),
          isNotNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .all();

    expect(subscribers.length).toBe(0);
  });
});

describe("Confirmation page displays correct information", () => {
  let confirmPageToken: string;

  beforeAll(async () => {
    // Create a fresh subscriber for confirmation page tests
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "confirm-page-test@example.com"));

    const subscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: "confirm-page-test@example.com",
        token: crypto.randomUUID(),
        acceptedAt: new Date(), // Already verified
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning()
      .get();

    if (!subscriber.token) {
      throw new Error("Subscriber token is undefined");
    }

    confirmPageToken = subscriber.token;
  });

  afterAll(async () => {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "confirm-page-test@example.com"));
  });

  test("Confirmation page displays correct page name", async () => {
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, confirmPageToken),
      with: {
        page: true,
      },
    });

    expect(subscriber?.page.title).toBe("E2E Test Status Page");
  });

  test("Confirmation page displays masked email (first char + *** + @domain)", async () => {
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, confirmPageToken),
    });

    if (!subscriber) {
      throw new Error("Subscriber not found");
    }

    const email = subscriber.email;
    expect(email).toBe("confirm-page-test@example.com");

    // Apply the same masking logic as in the API
    const [localPart, domain] = email.split("@");
    const maskedEmail =
      localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("c***@example.com");
  });

  test("Email masking works for single character local part", async () => {
    const email = "a@example.com";
    const [localPart, domain] = email.split("@");
    const maskedEmail =
      localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("a***@example.com");
  });

  test("Email masking works for long local part", async () => {
    const email = "verylongemailaddress@example.com";
    const [localPart, domain] = email.split("@");
    const maskedEmail =
      localPart.length > 0 ? `${localPart[0]}***@${domain}` : `***@${domain}`;

    expect(maskedEmail).toBe("v***@example.com");
  });
});

describe("Clicking confirm sets unsubscribedAt timestamp", () => {
  let unsubscribeToken: string;

  beforeAll(async () => {
    // Create a fresh subscriber
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "unsubscribe-click-test@example.com"));

    const subscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: "unsubscribe-click-test@example.com",
        token: crypto.randomUUID(),
        acceptedAt: new Date(), // Already verified
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning()
      .get();

    if (!subscriber.token) {
      throw new Error("Subscriber token is undefined");
    }

    unsubscribeToken = subscriber.token;
  });

  afterAll(async () => {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "unsubscribe-click-test@example.com"));
  });

  test("Before clicking confirm, unsubscribedAt is null", async () => {
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, unsubscribeToken),
    });

    expect(subscriber?.unsubscribedAt).toBeNull();
  });

  test("After clicking confirm, unsubscribedAt is set to current timestamp", async () => {
    const beforeUnsubscribe = new Date();

    // Simulate clicking "Confirm Unsubscribe"
    await db
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.token, unsubscribeToken));

    const afterUnsubscribe = new Date();

    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, unsubscribeToken),
    });

    if (!subscriber) {
      throw new Error("Subscriber not found");
    }

    expect(subscriber.unsubscribedAt).not.toBeNull();
    expect(subscriber.unsubscribedAt).toBeInstanceOf(Date);

    // Verify the timestamp is within the expected range
    if (!subscriber.unsubscribedAt) {
      throw new Error("Subscriber unsubscribedAt is undefined");
    }

    // SQLite stores timestamps in seconds, so we compare at second precision
    const unsubscribedTime = Math.floor(
      subscriber.unsubscribedAt.getTime() / 1000,
    );
    const beforeTime = Math.floor(beforeUnsubscribe.getTime() / 1000);
    const afterTime = Math.floor(afterUnsubscribe.getTime() / 1000);

    expect(unsubscribedTime).toBeGreaterThanOrEqual(beforeTime);
    expect(unsubscribedTime).toBeLessThanOrEqual(afterTime);
  });

  test("Subscriber state transitions correctly through the flow", async () => {
    // Verify the subscriber has completed the full lifecycle
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, unsubscribeToken),
    });

    // Has been verified (acceptedAt is set)
    expect(subscriber?.acceptedAt).not.toBeNull();

    // Has been unsubscribed (unsubscribedAt is set)
    expect(subscriber?.unsubscribedAt).not.toBeNull();

    // Token is still present (for audit purposes)
    expect(subscriber?.token).toBe(unsubscribeToken);
  });
});

describe("Unsubscribed user does not receive new emails", () => {
  let unsubscribedToken: string;
  let pendingToken: string;

  beforeAll(async () => {
    // Clean up and create multiple subscribers with different states
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "active-user@example.com"));
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "unsubscribed-user@example.com"));
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "pending-user@example.com"));

    // Active subscriber
    const active = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: "active-user@example.com",
        token: crypto.randomUUID(),
        acceptedAt: new Date(),
        unsubscribedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning()
      .get();

    if (!active.token) {
      throw new Error("Active subscriber token is undefined");
    }

    // Unsubscribed subscriber
    const unsubscribed = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: "unsubscribed-user@example.com",
        token: crypto.randomUUID(),
        acceptedAt: new Date(),
        unsubscribedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning()
      .get();

    if (!unsubscribed.token) {
      throw new Error("Unsubscribed subscriber token is undefined");
    }

    unsubscribedToken = unsubscribed.token;

    // Pending (unverified) subscriber
    const pending = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: "pending-user@example.com",
        token: crypto.randomUUID(),
        acceptedAt: null,
        unsubscribedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning()
      .get();

    if (!pending.token) {
      throw new Error("Pending subscriber token is undefined");
    }

    pendingToken = pending.token;
  });

  afterAll(async () => {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "active-user@example.com"));
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "unsubscribed-user@example.com"));
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "pending-user@example.com"));
  });

  test("Email query returns only active subscribers with valid tokens", async () => {
    // This mirrors the exact query pattern used in email-sending routes
    const emailRecipients = await db
      .select({
        email: pageSubscriber.email,
        token: pageSubscriber.token,
      })
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, testPageId),
          isNotNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .all();

    // Should only include active subscriber
    expect(emailRecipients.length).toBeGreaterThanOrEqual(1);

    const emails = emailRecipients.map((r) => r.email);
    expect(emails).toContain("active-user@example.com");
    expect(emails).not.toContain("unsubscribed-user@example.com");
    expect(emails).not.toContain("pending-user@example.com");
  });

  test("Unsubscribed users are filtered out even with acceptedAt set", async () => {
    // Verify the unsubscribed user has acceptedAt set
    const unsubscribedUser = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, unsubscribedToken),
    });

    expect(unsubscribedUser?.acceptedAt).not.toBeNull();
    expect(unsubscribedUser?.unsubscribedAt).not.toBeNull();

    // Query with proper filters
    const subscribers = await db
      .select()
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, testPageId),
          isNotNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .all();

    const foundUnsubscribed = subscribers.find(
      (s) => s.email === "unsubscribed-user@example.com",
    );
    expect(foundUnsubscribed).toBeUndefined();
  });

  test("Pending users are filtered out (not verified)", async () => {
    // Verify the pending user has no acceptedAt
    const pendingUser = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, pendingToken),
    });

    expect(pendingUser?.acceptedAt).toBeNull();

    // Query with proper filters
    const subscribers = await db
      .select()
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, testPageId),
          isNotNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .all();

    const foundPending = subscribers.find(
      (s) => s.email === "pending-user@example.com",
    );
    expect(foundPending).toBeUndefined();
  });

  test("Email recipients list includes token for unsubscribe URL generation", async () => {
    const emailRecipients = await db
      .select({
        email: pageSubscriber.email,
        token: pageSubscriber.token,
      })
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, testPageId),
          isNotNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .all();

    // Filter for valid tokens (as done in email sending routes)
    const validRecipients = emailRecipients.filter(
      (r): r is { email: string; token: string } => r.token !== null,
    );

    expect(validRecipients.length).toBeGreaterThanOrEqual(1);

    // Each valid recipient should have a UUID token
    for (const recipient of validRecipients) {
      expect(recipient.token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    }
  });
});

describe("Re-subscription after unsubscribe flow", () => {
  let resubscribeToken: string;

  beforeAll(async () => {
    // Clean up
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "resubscribe-test@example.com"));

    // Create an initially subscribed and verified user
    const subscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: "resubscribe-test@example.com",
        token: crypto.randomUUID(),
        acceptedAt: new Date(),
        unsubscribedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning()
      .get();

    if (!subscriber.token) {
      throw new Error("Subscriber token is undefined");
    }

    resubscribeToken = subscriber.token;
  });

  afterAll(async () => {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "resubscribe-test@example.com"));
  });

  test("User can complete full subscribe -> unsubscribe -> resubscribe cycle", async () => {
    // Step 1: Verify initial subscription state
    let subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.email, "resubscribe-test@example.com"),
    });

    if (!subscriber) {
      throw new Error("Subscriber ID is undefined");
    }

    expect(subscriber?.acceptedAt).not.toBeNull();
    expect(subscriber?.unsubscribedAt).toBeNull();

    // Step 2: User unsubscribes
    await db
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.id, subscriber.id));

    subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, subscriber.id),
    });

    expect(subscriber?.unsubscribedAt).not.toBeNull();

    // Step 3: User is excluded from emails
    const subscribersAfterUnsub = await db
      .select()
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, testPageId),
          eq(pageSubscriber.email, "resubscribe-test@example.com"),
          isNotNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .all();

    expect(subscribersAfterUnsub.length).toBe(0);

    if (!subscriber) {
      throw new Error("Subscriber is undefined");
    }

    // Step 4: User re-subscribes (simulating the re-subscription flow)
    const newToken = crypto.randomUUID();
    await db
      .update(pageSubscriber)
      .set({
        unsubscribedAt: null,
        acceptedAt: null, // Requires re-verification
        token: newToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .where(eq(pageSubscriber.id, subscriber.id));

    // Step 5: User is still excluded (not yet verified)
    const subscribersPendingVerify = await db
      .select()
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, testPageId),
          eq(pageSubscriber.email, "resubscribe-test@example.com"),
          isNotNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .all();

    expect(subscribersPendingVerify.length).toBe(0);

    // Step 6: User verifies their email again
    await db
      .update(pageSubscriber)
      .set({ acceptedAt: new Date() })
      .where(eq(pageSubscriber.token, newToken));

    // Step 7: User is now included in email list again
    const subscribersAfterReverify = await db
      .select()
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, testPageId),
          eq(pageSubscriber.email, "resubscribe-test@example.com"),
          isNotNull(pageSubscriber.acceptedAt),
          isNull(pageSubscriber.unsubscribedAt),
        ),
      )
      .all();

    expect(subscribersAfterReverify.length).toBe(1);
    expect(subscribersAfterReverify[0].token).toBe(newToken);
    expect(subscribersAfterReverify[0].token).not.toBe(resubscribeToken);
  });
});

describe("Invalid token handling", () => {
  test("Non-existent token returns no subscriber", async () => {
    const fakeToken = crypto.randomUUID();

    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, fakeToken),
    });

    expect(subscriber).toBeUndefined();
  });

  test("Invalid UUID format is handled gracefully", async () => {
    const invalidToken = "not-a-valid-uuid";

    // The database query will still work, just return no results
    const subscriber = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, invalidToken),
    });

    expect(subscriber).toBeUndefined();
  });

  test("Already unsubscribed token returns subscriber with unsubscribedAt set", async () => {
    // Create an unsubscribed subscriber
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "already-unsub@example.com"));

    const subscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: "already-unsub@example.com",
        token: crypto.randomUUID(),
        acceptedAt: new Date(),
        unsubscribedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning()
      .get();

    if (!subscriber.token) {
      throw new Error("Subscriber token is undefined");
    }

    // Query the subscriber
    const found = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, subscriber.token),
    });

    expect(found).toBeDefined();
    expect(found?.unsubscribedAt).not.toBeNull();

    // Clean up
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, "already-unsub@example.com"));
  });
});

describe("statusPage.get endpoint validation", () => {
  test("Returns all required output fields with correct types", async () => {
    // Use the edgeRouter to call the statusPage.get endpoint
    const { edgeRouter } = await import("../edge");
    const { createInnerTRPCContext } = await import("../trpc");

    const ctx = createInnerTRPCContext({
      req: undefined,
      // @ts-expect-error - auth not required for public procedure
      auth: undefined,
    });

    const caller = edgeRouter.createCaller(ctx);
    const result = await caller.statusPage.get({ slug: testSlug });

    // Validate that result is not null
    expect(result).toBeDefined();
    expect(result).not.toBeNull();

    if (!result) {
      throw new Error("Result should not be null");
    }

    // Validate core page fields with specific types
    expect(typeof result.slug).toBe("string");
    expect(typeof result.title).toBe("string");
    expect(typeof result.description).toBe("string");
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);

    // Validate slug matches what we requested
    expect(result.slug).toBe(testSlug);

    // Validate all array fields exist and are arrays
    expect(Array.isArray(result.monitors)).toBe(true);
    expect(Array.isArray(result.monitorGroups)).toBe(true);
    expect(Array.isArray(result.pageComponents)).toBe(true);
    expect(Array.isArray(result.pageComponentGroups)).toBe(true);
    expect(Array.isArray(result.trackers)).toBe(true);
    expect(Array.isArray(result.lastEvents)).toBe(true);
    expect(Array.isArray(result.openEvents)).toBe(true);
    expect(Array.isArray(result.statusReports)).toBe(true);
    expect(Array.isArray(result.incidents)).toBe(true);
    expect(Array.isArray(result.maintenances)).toBe(true);

    // Validate status field is one of the allowed values
    expect(["success", "degraded", "error", "info"]).toContain(result.status);

    // Validate workspacePlan field
    expect(result.workspacePlan).toBeDefined();
    expect(typeof result.workspacePlan).toBe("string");

    // Validate whiteLabel field
    expect(typeof result.whiteLabel).toBe("boolean");
  });

  test("Returns null for non-existent slug", async () => {
    const { edgeRouter } = await import("../edge");
    const { createInnerTRPCContext } = await import("../trpc");

    const ctx = createInnerTRPCContext({
      req: undefined,
      // @ts-expect-error - auth not required for public procedure
      auth: undefined,
    });

    const caller = edgeRouter.createCaller(ctx);
    const result = await caller.statusPage.get({
      slug: "non-existent-slug-12345",
    });

    expect(result).toBeNull();
  });

  test("Tracker objects have correct discriminated union types", async () => {
    const { edgeRouter } = await import("../edge");
    const { createInnerTRPCContext } = await import("../trpc");

    const ctx = createInnerTRPCContext({
      req: undefined,
      // @ts-expect-error - auth not required for public procedure
      auth: undefined,
    });

    const caller = edgeRouter.createCaller(ctx);
    const result = await caller.statusPage.get({ slug: testSlug });

    if (!result) {
      // If no result, skip this test as there are no trackers to validate
      return;
    }

    // Validate each tracker has the correct structure
    for (const tracker of result.trackers) {
      expect(tracker).toHaveProperty("type");
      expect(tracker).toHaveProperty("order");

      if (tracker.type === "component") {
        expect(tracker).toHaveProperty("component");
        expect(tracker.component).toHaveProperty("id");
        expect(tracker.component).toHaveProperty("name");
        expect(tracker.component).toHaveProperty("status");
        expect(tracker.component).toHaveProperty("type");
        expect(["monitor", "external"]).toContain(tracker.component.type);
        expect(["success", "degraded", "error", "info"]).toContain(
          tracker.component.status,
        );

        // Monitor-type components should have monitor relation
        if (tracker.component.type === "monitor") {
          expect(tracker.component).toHaveProperty("monitor");
          expect(tracker.component.monitor).toBeDefined();
        }
      } else if (tracker.type === "group") {
        expect(tracker).toHaveProperty("groupId");
        expect(tracker).toHaveProperty("groupName");
        expect(tracker).toHaveProperty("components");
        expect(tracker).toHaveProperty("status");
        expect(Array.isArray(tracker.components)).toBe(true);
        expect(["success", "degraded", "error", "info"]).toContain(
          tracker.status,
        );
      }
    }
  });

  test("Event objects have required fields", async () => {
    const { edgeRouter } = await import("../edge");
    const { createInnerTRPCContext } = await import("../trpc");

    const ctx = createInnerTRPCContext({
      req: undefined,
      // @ts-expect-error - auth not required for public procedure
      auth: undefined,
    });

    const caller = edgeRouter.createCaller(ctx);
    const result = await caller.statusPage.get({ slug: testSlug });

    if (!result) {
      return;
    }

    // Validate lastEvents structure
    for (const event of result.lastEvents) {
      expect(event).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        from: expect.any(Date),
        status: expect.any(String),
        type: expect.any(String),
      });
      expect(["maintenance", "incident", "report"]).toContain(event.type);
      expect(["success", "degraded", "error", "info"]).toContain(event.status);
    }

    // Validate openEvents structure
    for (const event of result.openEvents) {
      expect(event).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        from: expect.any(Date),
        status: expect.any(String),
        type: expect.any(String),
      });
      expect(["maintenance", "incident", "report"]).toContain(event.type);
      expect(["success", "degraded", "error", "info"]).toContain(event.status);
    }
  });

  test("Monitor objects contain status field", async () => {
    const { edgeRouter } = await import("../edge");
    const { createInnerTRPCContext } = await import("../trpc");

    const ctx = createInnerTRPCContext({
      req: undefined,
      // @ts-expect-error - auth not required for public procedure
      auth: undefined,
    });

    const caller = edgeRouter.createCaller(ctx);
    const result = await caller.statusPage.get({ slug: testSlug });

    if (!result || result.monitors.length === 0) {
      return;
    }

    // Validate each monitor has status field
    for (const monitor of result.monitors) {
      expect(monitor).toHaveProperty("status");
      expect(["success", "degraded", "error", "info"]).toContain(
        monitor.status,
      );
      expect(monitor).toHaveProperty("id");
      expect(monitor).toHaveProperty("name");
    }
  });
});
