import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { and, db, eq, sql } from "@openstatus/db";
import {
  auditLog,
  pageSubscriber,
  pageSubscriberToPageComponent,
} from "@openstatus/db/src/schema";

import {
  getSubscriberByToken,
  hasPendingSubscriber,
  unsubscribeSubscriber,
  updateSubscriberScope,
  upsertSelfSignupSubscriber,
  verifySelfSignupSubscriber,
} from "..";
import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  clearAuditLog,
  expectAuditRow,
  readAuditLog,
} from "../../../test/helpers";

// Seeded data we lean on (see packages/db/src/seed.mts):
//   workspace 1 = team plan, has status-subscribers=true
//   page 1      = slug "status", workspaceId 1, components 1 & 2
const PAGE_ID = 1;
const PAGE_SLUG = "status";
const COMPONENT_1 = 1;
const COMPONENT_2 = 2;

// Each describe block owns its own email so suites are independent.
const EMAILS = {
  upsert: "svc-upsert-test@example.com",
  upsertCase: "svc-upsert-case-test@example.com",
  upsertReactivate: "svc-upsert-reactivate-test@example.com",
  upsertPendingThenUnsub: "svc-upsert-pending-unsub-test@example.com",
  planGate: "svc-plan-gate-test@example.com",
  verify: "svc-verify-test@example.com",
  verifyExpired: "svc-expired-test@example.com",
  getByToken: "svc-token-test@example.com",
  scope: "svc-scope-test@example.com",
  scopeUnverified: "svc-scope-unverified@example.com",
  scopeUnsubbed: "svc-scope-unsubbed@example.com",
  unsub: "svc-unsub-test@example.com",
  hasPending: "svc-has-pending-test@example.com",
};

async function cleanAll() {
  for (const email of Object.values(EMAILS)) {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  }
  await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID);
}

beforeAll(cleanAll);
afterAll(cleanAll);

// ─── upsertSelfSignupSubscriber ──────────────────────────────────────────────

describe("upsertSelfSignupSubscriber", () => {
  const email = EMAILS.upsert;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID);
  });

  test("creates a new subscription for an unknown email", async () => {
    const result = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });

    expect(result.email).toBe(email);
    expect(result.pageId).toBe(PAGE_ID);
    expect(result.token).toBeDefined();
    expect(result.acceptedAt).toBeNull();
    expect(result.componentIds).toEqual([]);

    // Audit row written, attributed to the subscriber (not a workspace user).
    await expectAuditRow({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      action: "page_subscriber.create",
      entityType: "page_subscriber",
      entityId: result.id,
      actorType: "subscriber",
    });
  });

  test("token is stripped from the audit snapshot", async () => {
    const fresh = "svc-upsert-token-redaction@example.com";
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));

    const result = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });

    const rows = await readAuditLog({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      entityType: "page_subscriber",
      entityId: result.id,
    });
    const row = rows[0];
    expect(row).toBeDefined();
    // `after` is a JSON column — the schema parser hands us an object.
    const after = row?.after as Record<string, unknown> | null;
    expect(after).not.toBeNull();
    expect(after).not.toHaveProperty("token");

    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));
  });

  test("does not create a duplicate row when called again", async () => {
    await upsertSelfSignupSubscriber({ input: { email, pageId: PAGE_ID } });
    const rows = await db.query.pageSubscriber.findMany({
      where: eq(pageSubscriber.email, email),
    });
    expect(rows).toHaveLength(1);
  });

  test("merges new components into an existing pending subscription", async () => {
    const result = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID, componentIds: [COMPONENT_1] },
    });
    expect(result.componentIds).toContain(COMPONENT_1);

    // Component-merge path emits an `update` audit row.
    await expectAuditRow({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: result.id,
      actorType: "subscriber",
    });

    // Metadata records the merged component-id set so the change isn't
    // dropped by the empty-diff guard in `emitAudit`.
    const rows = await readAuditLog({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      entityType: "page_subscriber",
      entityId: result.id,
    });
    const updateRow = rows.find((r) => r.action === "page_subscriber.update");
    const metadata = updateRow?.metadata as
      | { componentIds?: number[] }
      | null
      | undefined;
    expect(metadata?.componentIds).toContain(COMPONENT_1);
  });

  test("refreshes expiresAt for a still-pending subscription", async () => {
    const before = new Date();
    await upsertSelfSignupSubscriber({ input: { email, pageId: PAGE_ID } });
    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.email, email),
    });
    expect(row?.expiresAt?.getTime()).toBeGreaterThan(before.getTime());
  });

  test("stores email in lowercase regardless of input casing", async () => {
    const fresh = EMAILS.upsertCase;
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));
    const result = await upsertSelfSignupSubscriber({
      input: { email: fresh.toUpperCase(), pageId: PAGE_ID },
    });
    expect(result.email).toBe(fresh);
  });

  test("creates a new row (does not reactivate) when email was previously unsubscribed and accepted", async () => {
    const fresh = EMAILS.upsertReactivate;
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));
    const initial = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });
    await db
      .update(pageSubscriber)
      .set({ acceptedAt: new Date(), unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.id, initial.id))
      .run();

    const result = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID, componentIds: [COMPONENT_1] },
    });

    expect(result.id).not.toBe(initial.id);
    expect(result.acceptedAt).toBeNull();
    expect(result.componentIds).toEqual([COMPONENT_1]);

    const oldRow = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, initial.id),
    });
    expect(oldRow?.unsubscribedAt).toBeDefined();
  });

  test("creates a new row when previously unsubscribed before ever verifying", async () => {
    const fresh = EMAILS.upsertPendingThenUnsub;
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));
    const pending = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });
    await db
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.id, pending.id))
      .run();

    const result = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });

    expect(result.id).not.toBe(pending.id);
    expect(result.acceptedAt).toBeNull();

    const oldRow = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, pending.id),
    });
    expect(oldRow?.unsubscribedAt).toBeDefined();
    expect(oldRow?.acceptedAt).toBeNull();
  });

  test("returns already-verified row without writing an audit row", async () => {
    const fresh = "svc-upsert-already-verified@example.com";
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));
    const initial = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });
    await db
      .update(pageSubscriber)
      .set({ acceptedAt: new Date() })
      .where(eq(pageSubscriber.id, initial.id))
      .run();

    // Capture audit count before, then call upsert again.
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
          eq(auditLog.entityId, String(initial.id)),
        ),
      );

    const result = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });
    expect(result.id).toBe(initial.id);
    expect(result.acceptedAt).not.toBeNull();

    const rows = await readAuditLog({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      entityType: "page_subscriber",
      entityId: initial.id,
    });
    expect(rows).toHaveLength(0);

    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));
  });

  test("throws for component IDs that do not belong to this page", async () => {
    await expect(
      upsertSelfSignupSubscriber({
        input: { email, pageId: PAGE_ID, componentIds: [9999] },
      }),
    ).rejects.toThrow("Some components do not belong to this page");
  });

  test("throws for a page ID that does not exist", async () => {
    await expect(
      upsertSelfSignupSubscriber({
        input: { email, pageId: 99999 },
      }),
    ).rejects.toThrow();
  });

  // Plan-gate: temporarily flip workspace 1's `status-subscribers` to
  // false, hit the function, then restore. Mirrors the pattern in
  // `apps/server/.../status-page.test.ts`.
  test("rejects when the workspace plan disables status-subscribers", async () => {
    await db.run(
      sql`UPDATE workspace SET limits = json_set(COALESCE(limits, '{}'), '$."status-subscribers"', json('false')) WHERE id = ${SEEDED_WORKSPACE_TEAM_ID}`,
    );
    try {
      await expect(
        upsertSelfSignupSubscriber({
          input: { email: EMAILS.planGate, pageId: PAGE_ID },
        }),
      ).rejects.toThrow("Upgrade to use status subscribers");
    } finally {
      await db.run(
        sql`UPDATE workspace SET limits = json_set(COALESCE(limits, '{}'), '$."status-subscribers"', json('true')) WHERE id = ${SEEDED_WORKSPACE_TEAM_ID}`,
      );
    }
  });
});

// ─── verifySelfSignupSubscriber ──────────────────────────────────────────────

describe("verifySelfSignupSubscriber", () => {
  const email = EMAILS.verify;
  let pendingToken: string;
  let pendingId: number;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    if (!sub.token) throw new Error("Token is undefined");
    pendingToken = sub.token;
    pendingId = sub.id;
  });

  test("returns null for an unknown token", async () => {
    const result = await verifySelfSignupSubscriber({
      input: { token: "non-existent-token-xyz" },
    });
    expect(result).toBeNull();
  });

  test("returns null when domain does not match page slug", async () => {
    const result = await verifySelfSignupSubscriber({
      input: { token: pendingToken, domain: "wrong-domain" },
    });
    expect(result).toBeNull();
  });

  test("marks the subscription as accepted on first verification + emits audit row", async () => {
    const result = await verifySelfSignupSubscriber({
      input: { token: pendingToken, domain: PAGE_SLUG },
    });
    expect(result).not.toBeNull();
    expect(result?.acceptedAt).toBeDefined();

    await expectAuditRow({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: pendingId,
      actorType: "subscriber",
    });
  });

  test("returns an already-accepted subscription idempotently and does not double-audit", async () => {
    // Clear audit rows for this entity, then call verify again.
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
          eq(auditLog.entityId, String(pendingId)),
        ),
      );

    const result = await verifySelfSignupSubscriber({
      input: { token: pendingToken, domain: PAGE_SLUG },
    });
    expect(result).not.toBeNull();
    expect(result?.acceptedAt).toBeDefined();

    const rows = await readAuditLog({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      entityType: "page_subscriber",
      entityId: pendingId,
    });
    expect(rows).toHaveLength(0);
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
        expiresAt: new Date(Date.now() - 1000),
      })
      .run();

    await expect(
      verifySelfSignupSubscriber({
        input: { token: "expired-token-xyz" },
      }),
    ).rejects.toThrow("Verification token expired");
  });
});

// ─── getSubscriberByToken ────────────────────────────────────────────────────

describe("getSubscriberByToken", () => {
  const email = EMAILS.getByToken;
  let token: string;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    if (!sub.token) throw new Error("Token is undefined");
    token = sub.token;
  });

  test("returns null for an unknown token", async () => {
    const result = await getSubscriberByToken({
      input: { token: "unknown-token-xyz" },
    });
    expect(result).toBeNull();
  });

  test("returns null when domain does not match", async () => {
    const result = await getSubscriberByToken({
      input: { token, domain: "wrong-domain" },
    });
    expect(result).toBeNull();
  });

  test('masks the email address as "x***@domain"', async () => {
    const result = await getSubscriberByToken({ input: { token } });
    expect(result).not.toBeNull();
    expect(result?.email).toMatch(/^s\*\*\*@example\.com$/);
    expect(result?.email).not.toBe(email);
  });

  test("returns subscription data for a valid token and matching domain", async () => {
    const result = await getSubscriberByToken({
      input: { token, domain: PAGE_SLUG },
    });
    expect(result).not.toBeNull();
    expect(result?.pageId).toBe(PAGE_ID);
    expect(result?.pageSlug).toBe(PAGE_SLUG);
  });

  test("never emits an audit row (read-only)", async () => {
    await db
      .delete(auditLog)
      .where(eq(auditLog.workspaceId, SEEDED_WORKSPACE_TEAM_ID));
    await getSubscriberByToken({ input: { token, domain: PAGE_SLUG } });
    const rows = await readAuditLog({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      entityType: "page_subscriber",
    });
    expect(rows).toHaveLength(0);
  });
});

// ─── updateSubscriberScope ───────────────────────────────────────────────────

describe("updateSubscriberScope", () => {
  const email = EMAILS.scope;
  let token: string;
  let subscriberId: number;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID, componentIds: [COMPONENT_1] },
    });
    if (!sub.token) throw new Error("Token is undefined");
    token = sub.token;
    subscriberId = sub.id;
    await verifySelfSignupSubscriber({ input: { token } });
  });

  beforeEach(async () => {
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
          eq(auditLog.entityId, String(subscriberId)),
        ),
      );
  });

  test("throws for an unknown token", async () => {
    await expect(
      updateSubscriberScope({
        input: { token: "unknown-token-xyz", componentIds: [] },
      }),
    ).rejects.toThrow();
  });

  test("throws when subscription is not yet verified", async () => {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, EMAILS.scopeUnverified));
    const sub = await upsertSelfSignupSubscriber({
      input: { email: EMAILS.scopeUnverified, pageId: PAGE_ID },
    });
    if (!sub.token) throw new Error("Token is undefined");

    await expect(
      updateSubscriberScope({
        input: { token: sub.token, componentIds: [] },
      }),
    ).rejects.toThrow("Subscription not yet verified");
  });

  test("throws when subscription is unsubscribed", async () => {
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.email, EMAILS.scopeUnsubbed));
    const sub = await upsertSelfSignupSubscriber({
      input: { email: EMAILS.scopeUnsubbed, pageId: PAGE_ID },
    });
    if (!sub.token) throw new Error("Token is undefined");
    await verifySelfSignupSubscriber({ input: { token: sub.token } });
    await unsubscribeSubscriber({ input: { token: sub.token } });

    await expect(
      updateSubscriberScope({
        input: { token: sub.token, componentIds: [] },
      }),
    ).rejects.toThrow("Subscription is unsubscribed");
  });

  test("replaces existing component scope and emits an audit row with metadata", async () => {
    await updateSubscriberScope({
      input: { token, componentIds: [COMPONENT_2] },
    });

    const rowsAfter = await db
      .select()
      .from(pageSubscriberToPageComponent)
      .where(eq(pageSubscriberToPageComponent.pageSubscriberId, subscriberId))
      .all();
    expect(rowsAfter.map((r) => r.pageComponentId)).toEqual([COMPONENT_2]);

    const auditRows = await readAuditLog({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      entityType: "page_subscriber",
      entityId: subscriberId,
    });
    const updateRow = auditRows.find(
      (r) => r.action === "page_subscriber.update",
    );
    expect(updateRow).toBeDefined();
    expect(updateRow?.actorType).toBe("subscriber");
    const metadata = updateRow?.metadata as
      | { componentIds?: number[]; previousComponentIds?: number[] }
      | null
      | undefined;
    expect(metadata?.componentIds).toEqual([COMPONENT_2]);
    expect(metadata?.previousComponentIds).toEqual([COMPONENT_1]);
  });

  test("can clear all components (entire-page scope)", async () => {
    await updateSubscriberScope({ input: { token, componentIds: [] } });
    const rowsAfter = await db
      .select()
      .from(pageSubscriberToPageComponent)
      .where(eq(pageSubscriberToPageComponent.pageSubscriberId, subscriberId))
      .all();
    expect(rowsAfter).toHaveLength(0);
  });

  test("throws when a component does not belong to this page", async () => {
    await expect(
      updateSubscriberScope({
        input: { token, componentIds: [9999] },
      }),
    ).rejects.toThrow("Some components do not belong to this page");
  });
});

// ─── unsubscribeSubscriber ───────────────────────────────────────────────────

describe("unsubscribeSubscriber", () => {
  const email = EMAILS.unsub;
  let token: string;
  let subscriberId: number;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    if (!sub.token) throw new Error("Token is undefined");
    token = sub.token;
    subscriberId = sub.id;
  });

  test("throws for an unknown token", async () => {
    await expect(
      unsubscribeSubscriber({ input: { token: "unknown-token-xyz" } }),
    ).rejects.toThrow();
  });

  test("throws when the domain does not match", async () => {
    await expect(
      unsubscribeSubscriber({
        input: { token, domain: "wrong-domain" },
      }),
    ).rejects.toThrow();
  });

  test("sets unsubscribedAt and emits an audit row", async () => {
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
          eq(auditLog.entityId, String(subscriberId)),
        ),
      );

    await expect(
      unsubscribeSubscriber({ input: { token, domain: PAGE_SLUG } }),
    ).resolves.toBeUndefined();

    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.token, token),
    });
    expect(row?.unsubscribedAt).toBeDefined();

    await expectAuditRow({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: subscriberId,
      actorType: "subscriber",
    });
  });

  test("is idempotent — second call does not emit a second audit row", async () => {
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.workspaceId, SEEDED_WORKSPACE_TEAM_ID),
          eq(auditLog.entityId, String(subscriberId)),
        ),
      );

    await expect(
      unsubscribeSubscriber({ input: { token } }),
    ).resolves.toBeUndefined();

    const rows = await readAuditLog({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      entityType: "page_subscriber",
      entityId: subscriberId,
    });
    expect(rows).toHaveLength(0);
  });
});

// ─── hasPendingSubscriber ────────────────────────────────────────────────────

describe("hasPendingSubscriber", () => {
  const email = EMAILS.hasPending;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  });

  afterEach(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  });

  test("returns false when no row exists", async () => {
    const result = await hasPendingSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    expect(result).toBe(false);
  });

  test("returns true for a pending unexpired row", async () => {
    await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    const result = await hasPendingSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    expect(result).toBe(true);
  });

  test("returns false for a pending row whose expiresAt has passed", async () => {
    const sub = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    await db
      .update(pageSubscriber)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(pageSubscriber.id, sub.id))
      .run();

    const result = await hasPendingSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    expect(result).toBe(false);
  });

  test("returns false for an already-verified (accepted) row", async () => {
    const sub = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    await db
      .update(pageSubscriber)
      .set({ acceptedAt: new Date() })
      .where(eq(pageSubscriber.id, sub.id))
      .run();

    const result = await hasPendingSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    expect(result).toBe(false);
  });

  test("returns false for an unsubscribed row", async () => {
    const sub = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    await db
      .update(pageSubscriber)
      .set({ unsubscribedAt: new Date() })
      .where(eq(pageSubscriber.id, sub.id))
      .run();

    const result = await hasPendingSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    expect(result).toBe(false);
  });
});
