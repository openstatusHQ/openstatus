import { db, eq } from "@openstatus/db";
import {
  page,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createPage,
  createTestWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { delivery, resend } from "@openstatus/emails/src/send";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";
import type Stripe from "stripe";

import { createInnerTRPCContext } from "../../trpc";
import { stripe } from "./shared";
import { PLANS } from "./utils";
import { webhookRouter } from "./webhook";

const TEAM_PRICE = PLANS.find((p) => p.plan === "team")?.price.monthly.priceIds
  .test;
const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);

// biome-ignore lint/suspicious/noExplicitAny: stubs over the Stripe and Resend clients
type AnyStub = Stub<any>;

function subscription(
  customer: string,
  overrides: Partial<Stripe.Subscription> = {},
) {
  return {
    id: "sub_test_1",
    customer,
    status: "active",
    created: now() - 30 * DAY,
    cancel_at_period_end: false,
    current_period_end: now() + 10 * DAY,
    metadata: {},
    items: { data: [{ price: { id: TEAM_PRICE }, quantity: 1 }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function event(
  type: string,
  object: Stripe.Subscription,
  previous_attributes?: Record<string, unknown>,
  id = `evt_${crypto.randomUUID()}`,
) {
  return {
    event: {
      id,
      created: now(),
      type,
      // biome-ignore lint/suspicious/noExplicitAny: zod record input
      data: { object: object as any, previous_attributes },
    },
  };
}

const caller = () =>
  webhookRouter.createCaller(createInnerTRPCContext({ session: null }));

describe("stripe webhook emails", () => {
  let live: Stripe.Subscription[];
  let stubs: AnyStub[];
  let send: AnyStub;
  let batch: AnyStub;
  let cancelEmail: AnyStub;
  let updateSubscription: AnyStub;

  beforeEach(() => {
    live = [];
    // biome-ignore lint/suspicious/noExplicitAny: Resend result double
    const ok = { data: { id: "email_reminder_1" }, error: null } as any;
    send = stub(resend.emails, "send", () => Promise.resolve(ok));
    batch = stub(resend.batch, "send", () => Promise.resolve(ok));
    cancelEmail = stub(resend.emails, "cancel", () => Promise.resolve(ok));
    updateSubscription = stub(stripe.subscriptions, "update", () =>
      // biome-ignore lint/suspicious/noExplicitAny: Stripe response double
      Promise.resolve({ cancel_at_period_end: true } as any),
    );
    stubs = [
      send,
      batch,
      cancelEmail,
      updateSubscription,
      stub(delivery, "enabled", () => true),
      stub(
        stripe.subscriptions,
        "list",
        // biome-ignore lint/suspicious/noExplicitAny: auto-paging list double
        () => ({ autoPagingToArray: () => Promise.resolve(live) }) as any,
      ),
      stub(stripe.customers, "retrieve", () =>
        Promise.resolve({
          deleted: false,
          email: "Billing-Contact@example.test",
          // biome-ignore lint/suspicious/noExplicitAny: Stripe customer double
        } as any),
      ),
    ];
  });

  afterEach(() => {
    for (const s of stubs) s.restore();
  });

  function failSends() {
    send.restore();
    batch.restore();
    stubs = stubs.filter((s) => s !== send && s !== batch);
    send = stub(resend.emails, "send", () =>
      Promise.reject(new Error("resend is down")),
    );
    batch = stub(resend.batch, "send", () =>
      Promise.reject(new Error("resend is down")),
    );
    stubs.push(send, batch);
  }

  async function seed() {
    const fixture = await createTestWorkspace();
    const ownerEmail = `owner-${fixture.user.id}@example.test`;
    await db
      .update(user)
      .set({ email: ownerEmail })
      .where(eq(user.id, fixture.user.id));
    return {
      ...fixture,
      ownerEmail,
      stripeId: fixture.workspace.stripeId ?? "",
    };
  }

  describe("customer.subscription.deleted", () => {
    test("live subscriptions left → no downgrade, no email", async () => {
      const s = await seed();
      live = [subscription(s.stripeId)];

      await caller().customerSubscriptionDeleted(
        event("customer.subscription.deleted", subscription(s.stripeId)),
      );

      const ws = await db
        .select()
        .from(workspace)
        .where(eq(workspace.id, s.workspace.id))
        .get();
      expect(ws?.plan).toBe("team");
      assertSpyCalls(send, 0);
      assertSpyCalls(batch, 0);
    });

    test("none left → plan-downgraded to owners + customer, member-removed per trimmed member", async () => {
      const s = await seed();
      const member = await createUser();
      const memberEmail = `member-${member.id}@example.test`;
      await db
        .update(user)
        .set({ email: memberEmail })
        .where(eq(user.id, member.id));
      await addUserToWorkspace(member.id, s.workspace.id, "member");
      // no email on file: cannot be notified, but still counts as removed
      const silent = await createUser({ email: null });
      await addUserToWorkspace(silent.id, s.workspace.id, "member");
      await createPage(s.workspace.id, {
        title: "Kept",
        createdAt: new Date("2020-01-01T00:00:00Z"),
      });
      await createPage(s.workspace.id, {
        title: "Gone",
        createdAt: new Date("2021-01-01T00:00:00Z"),
      });

      const evt = event(
        "customer.subscription.deleted",
        subscription(s.stripeId, { status: "canceled" }),
      );
      await caller().customerSubscriptionDeleted(evt);

      assertSpyCalls(send, 1);
      const [payload, options] = send.calls[0].args;
      expect(payload.to).toEqual([
        s.ownerEmail,
        "Billing-Contact@example.test",
      ]);
      expect(payload.subject).toBe(
        "Your workspace is on the free plan — 1 status page deleted",
      );
      expect(options).toEqual({
        idempotencyKey: `stripe:${evt.event.id}:plan-downgraded`,
      });
      expect(payload.react.props.loss.membersRemoved).toBe(2);

      assertSpyCalls(batch, 1);
      const [emails, batchOptions] = batch.calls[0].args;
      expect(emails.map((e: { to: string }) => e.to)).toEqual([memberEmail]);
      expect(emails[0].html).toContain(s.ownerEmail);
      expect(batchOptions).toEqual({
        idempotencyKey: `stripe:${evt.event.id}:member-removed:0`,
      });

      const pages = await db
        .select()
        .from(page)
        .where(eq(page.workspaceId, s.workspace.id))
        .all();
      expect(pages.length).toBe(1);
    });

    test("a mail failure never fails the handler; the downgrade is committed", async () => {
      const s = await seed();
      const member = await createUser();
      await db
        .update(user)
        .set({ email: `member-${member.id}@example.test` })
        .where(eq(user.id, member.id));
      await addUserToWorkspace(member.id, s.workspace.id, "member");
      failSends();

      await caller().customerSubscriptionDeleted(
        event(
          "customer.subscription.deleted",
          subscription(s.stripeId, { status: "canceled" }),
        ),
      );

      const ws = await db
        .select()
        .from(workspace)
        .where(eq(workspace.id, s.workspace.id))
        .get();
      expect(ws?.plan).toBe("free");
      assertSpyCalls(send, 1);
      assertSpyCalls(batch, 1);
      const members = await db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, s.workspace.id))
        .all();
      expect(members.length).toBe(1);
    });
  });

  describe("customer.subscription.updated", () => {
    test("cancel_at_period_end false → true: confirmation sent, reminder scheduled, id stored", async () => {
      const s = await seed();
      const sub = subscription(s.stripeId, { cancel_at_period_end: true });
      live = [sub];
      // The raw payload's period end is not trustworthy; only live state is.
      const raw = subscription(s.stripeId, {
        cancel_at_period_end: true,
        current_period_end: now() + 25 * DAY,
      });

      const evt = event("customer.subscription.updated", raw, {
        cancel_at_period_end: false,
      });
      await caller().customerSubscriptionUpdated(evt);

      assertSpyCalls(send, 2);
      const [confirmation, confirmationOptions] = send.calls[0].args;
      expect(confirmation.subject).toBe("Your openstatus cancellation");
      expect(confirmation.to).toEqual([
        s.ownerEmail,
        "Billing-Contact@example.test",
      ]);
      expect(confirmationOptions).toEqual({
        idempotencyKey: `stripe:${evt.event.id}:cancellation-scheduled`,
      });

      const [reminder, reminderOptions] = send.calls[1].args;
      expect(new Date(reminder.scheduledAt).getTime()).toBe(
        (sub.current_period_end - 3 * DAY) * 1000,
      );
      expect(reminderOptions).toEqual({
        idempotencyKey: `stripe:${evt.event.id}:plan-ending-soon`,
      });

      assertSpyCalls(updateSubscription, 1);
      expect(updateSubscription.calls[0].args).toEqual([
        sub.id,
        { metadata: { reminder_email_id: "email_reminder_1" } },
      ]);
    });

    test("period end beyond 30 days: confirmation only, nothing stored", async () => {
      const s = await seed();
      const sub = subscription(s.stripeId, {
        cancel_at_period_end: true,
        current_period_end: now() + 200 * DAY,
      });
      live = [sub];

      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub, {
          cancel_at_period_end: false,
        }),
      );

      assertSpyCalls(send, 1);
      expect(send.calls[0].args[0].scheduledAt).toBeUndefined();
      assertSpyCalls(updateSubscription, 0);
    });

    test("true → false: the scheduled reminder is cancelled and the id cleared", async () => {
      const s = await seed();
      const sub = subscription(s.stripeId, {
        metadata: { reminder_email_id: "email_reminder_1" },
      });
      live = [sub];

      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub, {
          cancel_at_period_end: true,
        }),
      );

      assertSpyCalls(send, 0);
      assertSpyCalls(cancelEmail, 1);
      expect(cancelEmail.calls[0].args[0]).toBe("email_reminder_1");
      expect(updateSubscription.calls[0].args).toEqual([
        sub.id,
        { metadata: { reminder_email_id: "" } },
      ]);
    });

    test("a stale cancel event after a resume sends nothing", async () => {
      const s = await seed();
      live = [subscription(s.stripeId, { cancel_at_period_end: false })];

      await caller().customerSubscriptionUpdated(
        event(
          "customer.subscription.updated",
          subscription(s.stripeId, { cancel_at_period_end: true }),
          { cancel_at_period_end: false },
        ),
      );

      assertSpyCalls(send, 0);
      assertSpyCalls(updateSubscription, 0);
    });

    test("a resume racing the metadata write cancels the fresh reminder", async () => {
      const s = await seed();
      const sub = subscription(s.stripeId, { cancel_at_period_end: true });
      live = [sub];
      updateSubscription.restore();
      stubs = stubs.filter((x) => x !== updateSubscription);
      updateSubscription = stub(stripe.subscriptions, "update", () =>
        // biome-ignore lint/suspicious/noExplicitAny: Stripe response double
        Promise.resolve({ cancel_at_period_end: false } as any),
      );
      stubs.push(updateSubscription);

      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub, {
          cancel_at_period_end: false,
        }),
      );

      expect(cancelEmail.calls[0].args[0]).toBe("email_reminder_1");
      expect(updateSubscription.calls.map((c) => c.args[1])).toEqual([
        { metadata: { reminder_email_id: "email_reminder_1" } },
        { metadata: { reminder_email_id: "" } },
      ]);
    });

    test("a failed reminder cancel keeps the id for a retry", async () => {
      const s = await seed();
      const sub = subscription(s.stripeId, {
        metadata: { reminder_email_id: "email_reminder_1" },
      });
      live = [sub];
      cancelEmail.restore();
      stubs = stubs.filter((x) => x !== cancelEmail);
      cancelEmail = stub(resend.emails, "cancel", () =>
        Promise.resolve({
          data: null,
          error: { name: "application_error" },
          // biome-ignore lint/suspicious/noExplicitAny: Resend error double
        } as any),
      );
      stubs.push(cancelEmail);

      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub, {
          cancel_at_period_end: true,
        }),
      );

      assertSpyCalls(cancelEmail, 1);
      assertSpyCalls(updateSubscription, 0);
    });

    test("a failed confirmation does not suppress the reminder", async () => {
      const s = await seed();
      const sub = subscription(s.stripeId, { cancel_at_period_end: true });
      live = [sub];
      send.restore();
      stubs = stubs.filter((x) => x !== send);
      let calls = 0;
      send = stub(resend.emails, "send", () =>
        calls++ === 0
          ? Promise.reject(new Error("resend is down"))
          : // biome-ignore lint/suspicious/noExplicitAny: Resend result double
            Promise.resolve({
              data: { id: "email_reminder_1" },
              error: null,
            } as any),
      );
      stubs.push(send);

      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub, {
          cancel_at_period_end: false,
        }),
      );

      assertSpyCalls(send, 2);
      expect(send.calls[1].args[0].scheduledAt).toBeDefined();
      assertSpyCalls(updateSubscription, 1);
    });

    test("metadata-only update and unrelated updates send nothing", async () => {
      const s = await seed();
      const sub = subscription(s.stripeId, { cancel_at_period_end: true });
      live = [sub];

      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub, { metadata: {} }),
      );
      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub),
      );

      assertSpyCalls(send, 0);
      assertSpyCalls(cancelEmail, 0);
      assertSpyCalls(updateSubscription, 0);
    });

    test("a replayed event reuses the same idempotency keys", async () => {
      const s = await seed();
      const sub = subscription(s.stripeId, { cancel_at_period_end: true });
      live = [sub];
      const evt = event("customer.subscription.updated", sub, {
        cancel_at_period_end: false,
      });

      await caller().customerSubscriptionUpdated(evt);
      await caller().customerSubscriptionUpdated(evt);

      const keys = send.calls.map((c) => c.args[1].idempotencyKey);
      expect(keys.slice(0, 2)).toEqual(keys.slice(2, 4));
    });

    test("a mail failure does not fail the plan sync", async () => {
      const s = await seed();
      const sub = subscription(s.stripeId, { cancel_at_period_end: true });
      live = [sub];
      failSends();

      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub, {
          cancel_at_period_end: false,
        }),
      );

      const ws = await db
        .select()
        .from(workspace)
        .where(eq(workspace.id, s.workspace.id))
        .get();
      expect(ws?.subscriptionId).toBe(sub.id);
    });
  });

  describe("customer.subscription.trial_will_end", () => {
    test("sends trial-ending once per event with trial_end in the body", async () => {
      const s = await seed();
      const trialEnd = Math.floor(
        new Date("2026-09-25T00:00:00Z").getTime() / 1000,
      );
      const evt = event(
        "customer.subscription.trial_will_end",
        subscription(s.stripeId, { status: "trialing", trial_end: trialEnd }),
      );

      await caller().customerSubscriptionTrialWillEnd(evt);

      assertSpyCalls(send, 1);
      const [payload, options] = send.calls[0].args;
      expect(payload.subject).toBe("Your openstatus trial ends soon");
      expect(payload.to).toContain(s.ownerEmail);
      expect(options).toEqual({
        idempotencyKey: `stripe:${evt.event.id}:trial-ending`,
      });
    });

    test("no trial_end → nothing sent", async () => {
      const s = await seed();
      await caller().customerSubscriptionTrialWillEnd(
        event(
          "customer.subscription.trial_will_end",
          subscription(s.stripeId, { trial_end: null }),
        ),
      );
      assertSpyCalls(send, 0);
    });
  });
});
