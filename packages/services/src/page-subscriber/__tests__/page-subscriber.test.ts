import { and, db, eq } from "@openstatus/db";
import {
  auditLog,
  page,
  pageSubscriber,
  pageSubscriberToPageComponent,
} from "@openstatus/db/src/schema";
import {
  createPage,
  createPageComponent,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  test,
} from "@std/testing/bdd";

import {
  clearAuditLog,
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import { ForbiddenError } from "../../errors";
import { expireSelfSignupVerification } from "../expire-verification.ts";
import {
  createPageSubscriber,
  getSubscriberByToken,
  hasPendingSubscriber,
  unsubscribePageSubscriber,
  unsubscribeSubscriber,
  updateSubscriberScope,
  upsertSelfSignupSubscriber,
  verifySelfSignupSubscriber,
} from "../index.ts";

// Built in `beforeAll` — this suite owns its workspace, page and components so
// its committed rows and audit trail can't be observed or wiped by siblings.
let WORKSPACE_ID: number;
let WORKSPACE: Awaited<ReturnType<typeof createWorkspaceFixture>>["workspace"];
let FREE_WORKSPACE_ID: number;
let PAGE_ID: number;
let PAGE_SLUG: string;
let COMPONENT_1: number;
let COMPONENT_2: number;

// Each describe block owns its own email so suites are independent.
const EMAILS = {
  upsert: "svc-upsert-test@example.com",
  upsertActiveClaim: "svc-upsert-active-claim@example.com",
  upsertCase: "svc-upsert-case-test@example.com",
  upsertExpiredClaim: "svc-upsert-expired-claim@example.com",
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
  unsubWorkspaceEmail: "svc-unsub-ws-email-test@example.com",
  unsubWorkspaceId: "svc-unsub-ws-id-test@example.com",
  unsubWorkspaceDenied: "svc-unsub-ws-denied-test@example.com",
  hasPending: "svc-has-pending-test@example.com",
};

async function cleanAll() {
  for (const email of Object.values(EMAILS)) {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  }
  await clearAuditLog(WORKSPACE_ID);
}

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  WORKSPACE = team.workspace;
  WORKSPACE_ID = team.workspace.id;
  FREE_WORKSPACE_ID = (await createWorkspaceFixture("free")).workspace.id;

  const p = await createPage(WORKSPACE_ID);
  PAGE_ID = p.id;
  PAGE_SLUG = p.slug;
  COMPONENT_1 = (await createPageComponent(WORKSPACE_ID, PAGE_ID)).id;
  COMPONENT_2 = (await createPageComponent(WORKSPACE_ID, PAGE_ID, { order: 1 }))
    .id;

  await cleanAll();
});
afterAll(cleanAll);

// ─── upsertSelfSignupSubscriber ──────────────────────────────────────────────

describe("upsertSelfSignupSubscriber", () => {
  const email = EMAILS.upsert;

  beforeAll(async () => {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    await clearAuditLog(WORKSPACE_ID);
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
    expect(result.shouldSendVerification).toBe(true);

    // Audit row written, attributed to the subscriber (not a workspace user).
    await expectAuditRow({
      workspaceId: WORKSPACE_ID,
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
      workspaceId: WORKSPACE_ID,
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
    const result = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    expect(result.shouldSendVerification).toBe(false);
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
      workspaceId: WORKSPACE_ID,
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: result.id,
      actorType: "subscriber",
    });

    // Metadata records the merged component-id set so the change isn't
    // dropped by the empty-diff guard in `emitAudit`.
    const rows = await readAuditLog({
      workspaceId: WORKSPACE_ID,
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

  test("merges component scope without refreshing an active verification claim", async () => {
    const fresh = EMAILS.upsertActiveClaim;
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));
    const initial = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });
    const before = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, initial.id),
    });

    const result = await upsertSelfSignupSubscriber({
      input: {
        email: fresh,
        pageId: PAGE_ID,
        componentIds: [COMPONENT_1],
      },
      claimVerification: true,
    });
    const after = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, initial.id),
    });

    expect(result.shouldSendVerification).toBe(false);
    expect(result.componentIds).toEqual([COMPONENT_1]);
    expect(after?.expiresAt).toEqual(before?.expiresAt);
  });

  test("rotates the token when reclaiming an expired verification", async () => {
    const fresh = EMAILS.upsertExpiredClaim;
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));
    const initial = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });
    await db
      .update(pageSubscriber)
      .set({ expiresAt: new Date(0) })
      .where(eq(pageSubscriber.id, initial.id));

    const result = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
      claimVerification: true,
    });

    expect(result.shouldSendVerification).toBe(true);
    expect(result.token).not.toBe(initial.token);

    if (!initial.token) throw new Error("Initial token is undefined");
    await expireSelfSignupVerification({
      subscriberId: initial.id,
      token: initial.token,
    });
    const current = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, initial.id),
    });
    expect(current?.expiresAt?.getTime()).toBeGreaterThan(Date.now());
  });

  test("does not reclaim an expired verification without a send claim", async () => {
    const fresh = EMAILS.upsertExpiredClaim;
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, fresh));
    const initial = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });
    const expiredAt = new Date(0);
    await db
      .update(pageSubscriber)
      .set({ expiresAt: expiredAt })
      .where(eq(pageSubscriber.id, initial.id));

    const result = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });
    const current = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, initial.id),
    });

    expect(result.shouldSendVerification).toBe(false);
    expect(result.token).toBe(initial.token);
    expect(current?.expiresAt).toEqual(expiredAt);
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
          eq(auditLog.workspaceId, WORKSPACE_ID),
          eq(auditLog.entityId, String(initial.id)),
        ),
      );

    const result = await upsertSelfSignupSubscriber({
      input: { email: fresh, pageId: PAGE_ID },
    });
    expect(result.id).toBe(initial.id);
    expect(result.acceptedAt).not.toBeNull();
    expect(result.shouldSendVerification).toBe(false);

    const rows = await readAuditLog({
      workspaceId: WORKSPACE_ID,
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

  test("rejects when the workspace plan disables status-subscribers", async () => {
    // Rolled-back tx so the free-workspace page never commits — a
    // committed page would trip `page.test.ts`'s free-plan
    // `status-pages` quota assertions under `deno test --parallel`.
    await withTestTransaction(async (tx) => {
      const freePage = await tx
        .insert(page)
        .values({
          workspaceId: FREE_WORKSPACE_ID,
          title: "plan-gate",
          description: "plan-gate",
          slug: `plan-gate-${Date.now()}`,
          customDomain: "",
        })
        .returning()
        .get();
      await expect(
        upsertSelfSignupSubscriber({
          input: { email: EMAILS.planGate, pageId: freePage.id },
          db: tx,
        }),
      ).rejects.toThrow("Upgrade to use status subscribers");
    });
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
      workspaceId: WORKSPACE_ID,
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
          eq(auditLog.workspaceId, WORKSPACE_ID),
          eq(auditLog.entityId, String(pendingId)),
        ),
      );

    const result = await verifySelfSignupSubscriber({
      input: { token: pendingToken, domain: PAGE_SLUG },
    });
    expect(result).not.toBeNull();
    expect(result?.acceptedAt).toBeDefined();

    const rows = await readAuditLog({
      workspaceId: WORKSPACE_ID,
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
    await db.delete(auditLog).where(eq(auditLog.workspaceId, WORKSPACE_ID));
    await getSubscriberByToken({ input: { token, domain: PAGE_SLUG } });
    const rows = await readAuditLog({
      workspaceId: WORKSPACE_ID,
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
          eq(auditLog.workspaceId, WORKSPACE_ID),
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
      workspaceId: WORKSPACE_ID,
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
          eq(auditLog.workspaceId, WORKSPACE_ID),
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
      workspaceId: WORKSPACE_ID,
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
          eq(auditLog.workspaceId, WORKSPACE_ID),
          eq(auditLog.entityId, String(subscriberId)),
        ),
      );

    await expect(
      unsubscribeSubscriber({ input: { token } }),
    ).resolves.toBeUndefined();

    const rows = await readAuditLog({
      workspaceId: WORKSPACE_ID,
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

// ─── createPageSubscriber ────────────────────────────────────────────────────

describe("createPageSubscriber", () => {
  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const team = (await createWorkspaceFixture("team")).workspace;
      const readOnlyCtx = {
        ...makeApiKeyCtx(team, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        createPageSubscriber({
          ctx: readOnlyCtx,
          input: {
            pageId: PAGE_ID,
            channelType: "email",
            email: "rejects-read@test.dev",
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

// ─── unsubscribePageSubscriber ───────────────────────────────────────────────

describe("unsubscribePageSubscriber", () => {
  function writeCtx() {
    return makeApiKeyCtx(WORKSPACE, { keyId: "k-write", userId: 1 });
  }

  function readCtx() {
    return makeApiKeyCtx(WORKSPACE, {
      keyId: "k-read",
      userId: 1,
      scopes: ["read"],
    });
  }

  async function seed(email: string) {
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    return upsertSelfSignupSubscriber({ input: { email, pageId: PAGE_ID } });
  }

  test("rejects read-only actor", async () => {
    await expect(
      unsubscribePageSubscriber({
        ctx: readCtx(),
        input: {
          pageId: PAGE_ID,
          identifier: { type: "email", value: EMAILS.unsubWorkspaceDenied },
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("unsubscribes by email and emits an apiKey-actor audit row", async () => {
    const email = EMAILS.unsubWorkspaceEmail;
    const sub = await seed(email);
    await clearAuditLog(WORKSPACE_ID);

    await expect(
      unsubscribePageSubscriber({
        ctx: writeCtx(),
        input: { pageId: PAGE_ID, identifier: { type: "email", value: email } },
      }),
    ).resolves.toBeUndefined();

    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, sub.id),
    });
    expect(row?.unsubscribedAt).toBeDefined();

    await expectAuditRow({
      workspaceId: WORKSPACE_ID,
      action: "page_subscriber.update",
      entityType: "page_subscriber",
      entityId: sub.id,
      actorType: "apiKey",
    });
  });

  test("matches email case-insensitively", async () => {
    const email = EMAILS.unsubWorkspaceId;
    const sub = await seed(email);

    await expect(
      unsubscribePageSubscriber({
        ctx: writeCtx(),
        input: {
          pageId: PAGE_ID,
          identifier: { type: "email", value: email.toUpperCase() },
        },
      }),
    ).resolves.toBeUndefined();

    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, sub.id),
    });
    expect(row?.unsubscribedAt).toBeDefined();
  });

  test("throws when the page belongs to another workspace", async () => {
    const freeWorkspace = { ...WORKSPACE, id: FREE_WORKSPACE_ID };
    await expect(
      unsubscribePageSubscriber({
        ctx: makeApiKeyCtx(freeWorkspace, { keyId: "k-other", userId: 2 }),
        input: {
          pageId: PAGE_ID,
          identifier: { type: "email", value: EMAILS.unsubWorkspaceEmail },
        },
      }),
    ).rejects.toThrow();
  });

  test("throws for an unknown subscriber", async () => {
    await expect(
      unsubscribePageSubscriber({
        ctx: writeCtx(),
        input: { pageId: PAGE_ID, identifier: { type: "id", value: 999_999 } },
      }),
    ).rejects.toThrow();
  });
});

describe("unsubscribePageSubscriber by id", () => {
  test("unsubscribes an existing row addressed by id", async () => {
    const email = "svc-unsub-ws-byid-test@example.com";
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });

    await expect(
      unsubscribePageSubscriber({
        ctx: makeApiKeyCtx(WORKSPACE, { keyId: "k-write", userId: 1 }),
        input: {
          pageId: PAGE_ID,
          identifier: { type: "id", value: sub.id },
        },
      }),
    ).resolves.toBeUndefined();

    const row = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, sub.id),
    });
    expect(row?.unsubscribedAt).toBeDefined();

    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  });

  test("an already-unsubscribed email is not found again", async () => {
    // The email lookup filters on `unsubscribedAt IS NULL`, so a repeat
    // call must not silently succeed against a stale row.
    const email = "svc-unsub-ws-stale-test@example.com";
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    await upsertSelfSignupSubscriber({ input: { email, pageId: PAGE_ID } });
    const ctx = makeApiKeyCtx(WORKSPACE, { keyId: "k-write", userId: 1 });
    const input = {
      pageId: PAGE_ID,
      identifier: { type: "email" as const, value: email },
    };

    await expect(
      unsubscribePageSubscriber({ ctx, input }),
    ).resolves.toBeUndefined();
    await expect(unsubscribePageSubscriber({ ctx, input })).rejects.toThrow();

    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  });

  test("a repeat unsubscribe by id is a no-op", async () => {
    const email = "svc-unsub-ws-byid-repeat-test@example.com";
    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
    const sub = await upsertSelfSignupSubscriber({
      input: { email, pageId: PAGE_ID },
    });
    const ctx = makeApiKeyCtx(WORKSPACE, { keyId: "k-write", userId: 1 });
    const input = {
      pageId: PAGE_ID,
      identifier: { type: "id" as const, value: sub.id },
    };

    await unsubscribePageSubscriber({ ctx, input });
    const first = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, sub.id),
    });
    await clearAuditLog(WORKSPACE_ID);

    await expect(
      unsubscribePageSubscriber({ ctx, input }),
    ).resolves.toBeUndefined();

    const second = await db.query.pageSubscriber.findFirst({
      where: eq(pageSubscriber.id, sub.id),
    });
    expect(second?.unsubscribedAt).toEqual(first?.unsubscribedAt);

    const rows = await readAuditLog({
      workspaceId: WORKSPACE_ID,
      entityType: "page_subscriber",
      entityId: String(sub.id),
    });
    expect(rows).toHaveLength(0);

    await db.delete(pageSubscriber).where(eq(pageSubscriber.email, email));
  });
});
