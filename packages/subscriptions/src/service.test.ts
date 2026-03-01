import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, db, eq, isNull } from "@openstatus/db";
import { pageSubscriber } from "@openstatus/db/src/schema";
import {
  getSubscriptionByToken,
  unsubscribe,
  updateSubscriptionScope,
  upsertEmailSubscription,
  verifySubscription,
} from "./service";

// IDs present in the seeded database
const PAGE_ID = 1; // slug: "status", customDomain: ""
const COMPONENT_1 = 1;
const COMPONENT_2 = 2;

// One email per describe block to keep them fully independent
const EMAILS = {
  upsert: "svc-upsert-test@example.com",
  verify: "svc-verify-test@example.com",
  verifyExpired: "svc-expired-test@example.com",
  getByToken: "svc-token-test@example.com",
  scope: "svc-scope-test@example.com",
  scopeUnverified: "svc-scope-unverified@example.com",
  scopeUnsubbed: "svc-scope-unsubbed@example.com",
  unsub: "svc-unsub-test@example.com",
};

async function cleanAll() {
  for (const email of Object.values(EMAILS)) {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  }
}

beforeAll(cleanAll);
afterAll(cleanAll);

// ─── upsertEmailSubscription ──────────────────────────────────────────────────

describe("upsertEmailSubscription", () => {
  const email = EMAILS.upsert;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  });

  test("creates a new subscription for an unknown email", async () => {
    const result = await upsertEmailSubscription({ email, pageId: PAGE_ID });

    expect(result.email).toBe(email);
    expect(result.pageId).toBe(PAGE_ID);
    expect(result.token).toBeDefined();
    expect(result.acceptedAt).toBeUndefined();
    expect(result.componentIds).toEqual([]);
  });

  test("does not create a duplicate row when called again", async () => {
    await upsertEmailSubscription({ email, pageId: PAGE_ID });

    const rows = await db.query.pageSubscriber.findMany({
      where: eq(pageSubscriber.email, email),
    });

    expect(rows).toHaveLength(1);
  });

  test("merges new components into an existing subscription", async () => {
    const result = await upsertEmailSubscription({
      email,
      pageId: PAGE_ID,
      componentIds: [COMPONENT_1],
    });

    expect(result.componentIds).toContain(COMPONENT_1);
  });

  test("refreshes expiresAt for a still-pending subscription", async () => {
    const before = new Date();
    await upsertEmailSubscription({ email, pageId: PAGE_ID });

    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.email, email),
    });

    expect(row?.expiresAt?.getTime()).toBeGreaterThan(before.getTime());
  });

  test("stores email in lowercase regardless of input casing", async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));

    const result = await upsertEmailSubscription({
      email: email.toUpperCase(),
      pageId: PAGE_ID,
    });

    expect(result.email).toBe(email);
  });

  test("creates a new row (does not reactivate) when email was previously unsubscribed", async () => {
    const existing = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.email, email),
    });

    if (!existing) {
      throw new Error("Existing subscriber not found");
    }

    await db
      .update(pageSubscriber)
      .set({ acceptedAt: new Date(), unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.id, existing.id))
      .run();

    const result = await upsertEmailSubscription({
      email,
      pageId: PAGE_ID,
      componentIds: [COMPONENT_1],
    });

    // A brand-new row — not a mutation of the old one
    expect(result.id).not.toBe(existing.id);
    expect(result.acceptedAt).toBeUndefined(); // requires re-verification
    expect(result.componentIds).toEqual([COMPONENT_1]);

    // Old row is preserved with its unsubscribedAt intact
    const oldRow = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, existing.id),
    });
    expect(oldRow?.unsubscribedAt).toBeDefined();
  });

  test("creates a new row when email was unsubscribed before ever verifying", async () => {
    // Find the currently active (pending, never verified) row left by the previous test
    const pending = await db.query.pageSubscriber.findFirst({
      where: and(
        eq(pageSubscriber.email, email),
        isNull(pageSubscriber.unsubscribedAt),
      ),
    });
    if (!pending) throw new Error("Pending subscriber not found");
    expect(pending.acceptedAt).toBeNull(); // confirm it was never verified

    await db
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.id, pending.id))
      .run();

    const result = await upsertEmailSubscription({ email, pageId: PAGE_ID });

    expect(result.id).not.toBe(pending.id);
    expect(result.acceptedAt).toBeUndefined();

    // Old unverified+unsubscribed row still has both fields set correctly
    const oldRow = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, pending.id),
    });
    expect(oldRow?.unsubscribedAt).toBeDefined();
    expect(oldRow?.acceptedAt).toBeNull();
  });

  test("throws for component IDs that do not belong to this page", async () => {
    await expect(
      upsertEmailSubscription({ email, pageId: PAGE_ID, componentIds: [9999] }),
    ).rejects.toThrow("Invalid components: 9999");
  });

  test("throws for a page ID that does not exist", async () => {
    await expect(
      upsertEmailSubscription({ email, pageId: 99999 }),
    ).rejects.toThrow("Page 99999 not found");
  });
});

// ─── verifySubscription ───────────────────────────────────────────────────────

describe("verifySubscription", () => {
  const email = EMAILS.verify;
  let pendingToken: string;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertEmailSubscription({ email, pageId: PAGE_ID });
    if (!sub.token) {
      throw new Error("Token is undefined");
    }
    pendingToken = sub.token;
  });

  test("returns null for an unknown token", async () => {
    const result = await verifySubscription("non-existent-token-xyz");
    expect(result).toBeNull();
  });

  test("returns null when domain does not match page slug", async () => {
    const result = await verifySubscription(pendingToken, "wrong-domain");
    expect(result).toBeNull();
  });

  test("marks the subscription as accepted on first verification", async () => {
    const result = await verifySubscription(pendingToken, "status");
    expect(result).not.toBeNull();
    expect(result?.acceptedAt).toBeDefined();
  });

  test("returns an already-accepted subscription idempotently", async () => {
    // pendingToken now points to an accepted subscription from the previous test
    const result = await verifySubscription(pendingToken, "status");
    expect(result).not.toBeNull();
    expect(result?.acceptedAt).toBeDefined();
  });

  test("throws for a token with an expired expiresAt", async () => {
    const expiredEmail = EMAILS.verifyExpired;
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, expiredEmail));

    await db
      .insert(pageSubscriber)
      .values({
        channelType: "email",
        email: expiredEmail,
        pageId: PAGE_ID,
        token: "expired-token-xyz",
        expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      })
      .run();

    await expect(verifySubscription("expired-token-xyz")).rejects.toThrow(
      "Verification token expired",
    );
  });
});

// ─── getSubscriptionByToken ───────────────────────────────────────────────────

describe("getSubscriptionByToken", () => {
  const email = EMAILS.getByToken;
  let token: string;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertEmailSubscription({ email, pageId: PAGE_ID });
    if (!sub.token) {
      throw new Error("Token is undefined");
    }
    token = sub.token;
  });

  test("returns null for an unknown token", async () => {
    const result = await getSubscriptionByToken("unknown-token-xyz");
    expect(result).toBeNull();
  });

  test("returns null when domain does not match", async () => {
    const result = await getSubscriptionByToken(token, "wrong-domain");
    expect(result).toBeNull();
  });

  test('masks the email address as "x***@domain"', async () => {
    const result = await getSubscriptionByToken(token);
    expect(result).not.toBeNull();
    // "svc-token-test@example.com" → "s***@example.com"
    expect(result?.email).toMatch(/^s\*\*\*@example\.com$/);
    expect(result?.email).not.toBe(email);
  });

  test("returns subscription data for a valid token and matching domain", async () => {
    const result = await getSubscriptionByToken(token, "status");
    expect(result).not.toBeNull();
    expect(result?.pageId).toBe(PAGE_ID);
    expect(result?.pageSlug).toBe("status");
  });
});

// ─── updateSubscriptionScope ──────────────────────────────────────────────────

describe("updateSubscriptionScope", () => {
  const email = EMAILS.scope;
  let token: string;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertEmailSubscription({
      email,
      pageId: PAGE_ID,
      componentIds: [COMPONENT_1],
    });
    if (!sub.token) {
      throw new Error("Token is undefined");
    }
    token = sub.token;
    // Verify so acceptedAt is set — required by the guard added to updateSubscriptionScope
    await verifySubscription(token);
  });

  test("throws for an unknown token", async () => {
    await expect(
      updateSubscriptionScope({ token: "unknown-token-xyz", componentIds: [] }),
    ).rejects.toThrow("Subscription not found");
  });

  test("throws when subscription is not yet verified", async () => {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, EMAILS.scopeUnverified));
    const sub = await upsertEmailSubscription({
      email: EMAILS.scopeUnverified,
      pageId: PAGE_ID,
    });
    if (!sub.token) throw new Error("Token is undefined");

    await expect(
      updateSubscriptionScope({ token: sub.token, componentIds: [] }),
    ).rejects.toThrow("Subscription not yet verified");
  });

  test("throws when subscription is unsubscribed", async () => {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, EMAILS.scopeUnsubbed));
    const sub = await upsertEmailSubscription({
      email: EMAILS.scopeUnsubbed,
      pageId: PAGE_ID,
    });
    if (!sub.token) throw new Error("Token is undefined");
    await verifySubscription(sub.token);
    await unsubscribe(sub.token);

    await expect(
      updateSubscriptionScope({ token: sub.token, componentIds: [] }),
    ).rejects.toThrow("Subscription is unsubscribed");
  });

  test("replaces existing component scope with new ones", async () => {
    const result = await updateSubscriptionScope({
      token,
      componentIds: [COMPONENT_2],
    });

    expect(result.componentIds).toEqual([COMPONENT_2]);
    expect(result.componentIds).not.toContain(COMPONENT_1);
  });

  test("can clear all components (switches to entire-page scope)", async () => {
    const result = await updateSubscriptionScope({ token, componentIds: [] });
    expect(result.componentIds).toEqual([]);
  });

  test("throws when a component does not belong to this page", async () => {
    await expect(
      updateSubscriptionScope({ token, componentIds: [9999] }),
    ).rejects.toThrow("Some components do not belong to this page");
  });
});

// ─── unsubscribe ──────────────────────────────────────────────────────────────

describe("unsubscribe", () => {
  const email = EMAILS.unsub;
  let token: string;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertEmailSubscription({ email, pageId: PAGE_ID });
    if (!sub.token) {
      throw new Error("Token is undefined");
    }
    token = sub.token;
  });

  test("throws for an unknown token", async () => {
    await expect(unsubscribe("unknown-token-xyz")).rejects.toThrow(
      "Subscription not found",
    );
  });

  test("throws when the domain does not match", async () => {
    await expect(unsubscribe(token, "wrong-domain")).rejects.toThrow(
      "Subscription not found",
    );
  });

  test("sets unsubscribedAt on a valid token", async () => {
    await expect(unsubscribe(token, "status")).resolves.toBeUndefined();

    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, token),
    });
    expect(row?.unsubscribedAt).toBeDefined();
  });

  test("resolves silently if the subscription is already unsubscribed", async () => {
    await expect(unsubscribe(token)).resolves.toBeUndefined();
  });
});
