import { and, db, desc, eq } from "@openstatus/db";
import {
  auditLog,
  selectUserSchema,
  selectWorkspaceSchema,
  user,
  workspace,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createTestWorkspace,
  createWorkspace,
} from "@openstatus/db/src/test/factories";
import { delivery, resend } from "@openstatus/emails/src/send";
import type Stripe from "stripe";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest";

import { edgeRouter } from "../../edge";
import { createInnerTRPCContext } from "../../trpc";
import { stripeRouter } from "./index";
import { cancelSubscription, stripe } from "./shared";
import { FEATURES, PLANS } from "./utils";
import { webhookRouter } from "./webhook";

const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
const STARTER_PRICE =
  PLANS.find((p) => p.plan === "starter")?.price.monthly.priceIds.test ?? "";
const TEAM_PRICE =
  PLANS.find((p) => p.plan === "team")?.price.monthly.priceIds.test ?? "";
const WHITE_LABEL_PRICE =
  FEATURES.find((f) => f.feature === "white-label")?.price.monthly.priceIds
    .test ?? "";

function subscription(
  customer: string,
  overrides: Partial<Stripe.Subscription> = {},
  price = STARTER_PRICE,
) {
  const periodEnd = now() + 14 * DAY;
  return {
    id: `sub_${crypto.randomUUID()}`,
    customer,
    status: "trialing",
    created: now() - DAY,
    trial_end: periodEnd,
    cancel_at_period_end: false,
    default_payment_method: null,
    metadata: {},
    currency: "usd",
    items: {
      data: [
        {
          id: "si_plan",
          price: { id: price, recurring: { interval: "month" } },
          quantity: 1,
          current_period_end: periodEnd,
        },
      ],
    },
    ...overrides,
  } as Stripe.Subscription;
}

async function seedTrial() {
  const stripeId = `cus_${crypto.randomUUID()}`;
  const trialEndsAt = new Date((now() + 14 * DAY) * 1000);
  const fixture = await createTestWorkspace({
    plan: "starter",
    stripeId,
    limits: "{}",
    trialEndsAt,
  });
  const ws = selectWorkspaceSchema.parse(fixture.workspace);
  return { ...fixture, ws, stripeId, trialEndsAt };
}

function customerWith(defaultPaymentMethod: string | null) {
  const invoiceSettings: Partial<Stripe.Customer.InvoiceSettings> = {
    default_payment_method: defaultPaymentMethod,
  };
  const partial: Partial<Stripe.Customer> = {
    invoice_settings: invoiceSettings as Stripe.Customer.InvoiceSettings,
  };
  return partial as Stripe.Customer;
}

async function readWorkspace(id: number) {
  return db.select().from(workspace).where(eq(workspace.id, id)).get();
}

async function lastPlanAuditReason(workspaceId: number) {
  const row = await db
    .select({ metadata: auditLog.metadata })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.workspaceId, workspaceId),
        eq(auditLog.entityType, "workspace"),
        eq(auditLog.action, "workspace.update"),
      ),
    )
    .orderBy(desc(auditLog.id))
    .get();
  return (row?.metadata as { reason?: string } | null)?.reason;
}

function asCaller(fixture: Awaited<ReturnType<typeof seedTrial>>) {
  return createInnerTRPCContext({
    session: { user: { id: String(fixture.user.id) } },
    workspace: fixture.ws,
    user: selectUserSchema.parse(fixture.user),
  });
}

async function readTrialedAt(workspaceId: number) {
  const row = await db
    .select({ trialedAt: workspace.trialedAt })
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .get();
  return row?.trialedAt;
}

describe("trial lifecycle", () => {
  let live: Stripe.Subscription[];
  let customer: Stripe.Customer;
  let stubs: MockInstance[];
  let updateSubscription: MockInstance;
  let cancelStripeSubscription: MockInstance;
  let createSession: MockInstance;

  beforeEach(() => {
    live = [];
    customer = customerWith(null);
    updateSubscription = vi
      .spyOn(stripe.subscriptions, "update")
      .mockImplementation(
        (id: string, params?: Stripe.SubscriptionUpdateParams) => {
          const base = live.find((s) => s.id === id) ?? subscription("cus_x");
          const items = params?.items?.[0]?.price
            ? {
                ...base.items,
                data: [
                  {
                    ...base.items.data[0],
                    price: { id: params.items[0].price },
                  } as Stripe.SubscriptionItem,
                ],
              }
            : base.items;
          return Promise.resolve({
            ...base,
            items,
            status: params?.trial_end === "now" ? "active" : base.status,
            trial_end: params?.trial_end === "now" ? null : base.trial_end,
          } as Stripe.Response<Stripe.Subscription>);
        },
      );
    cancelStripeSubscription = vi
      .spyOn(stripe.subscriptions, "cancel")
      .mockImplementation(() =>
        Promise.resolve({} as Stripe.Response<Stripe.Subscription>),
      );
    createSession = vi
      .spyOn(stripe.checkout.sessions, "create")
      .mockImplementation(() =>
        Promise.resolve({
          url: "https://checkout.stripe.test/session",
        } as Stripe.Response<Stripe.Checkout.Session>),
      );
    stubs = [
      updateSubscription,
      cancelStripeSubscription,
      createSession,
      vi.spyOn(stripe.subscriptions, "list").mockImplementation(
        () =>
          ({
            autoPagingToArray: (_opts: { limit: number }) =>
              Promise.resolve(live),
          }) as Stripe.ApiListPromise<Stripe.Subscription>,
      ),
      vi
        .spyOn(stripe.customers, "retrieve")
        .mockImplementation(() =>
          Promise.resolve(customer as Stripe.Response<Stripe.Customer>),
        ),
    ];
  });

  afterEach(() => {
    for (const s of stubs) s.mockRestore();
  });

  function withCard() {
    customer = customerWith("pm_card");
  }

  describe("getCheckoutSession", () => {
    test("trialing without a card → regular checkout, no in-place swap", async () => {
      const s = await seedTrial();
      live = [subscription(s.stripeId)];

      const result = await stripeRouter
        .createCaller(asCaller(s))
        .getCheckoutSession({
          currency: "USD",
          workspaceSlug: s.ws.slug,
          plan: "team",
        });

      expect(result?.type).toBe("checkout");
      expect(updateSubscription).toHaveBeenCalledTimes(0);
      expect(createSession.mock.calls[0]?.[0]).toMatchObject({
        mode: "subscription",
        customer: s.stripeId,
        line_items: [{ price: TEAM_PRICE, quantity: 1 }],
      });
    });

    test("trialing without a card on Starter monthly → setup session", async () => {
      const s = await seedTrial();
      const sub = subscription(s.stripeId);
      live = [sub];

      const result = await stripeRouter
        .createCaller(asCaller(s))
        .getCheckoutSession({
          currency: "USD",
          workspaceSlug: s.ws.slug,
          plan: "starter",
        });

      expect(result?.type).toBe("setup");
      expect(createSession.mock.calls[0]?.[0]).toMatchObject({
        mode: "setup",
        customer: s.stripeId,
        setup_intent_data: { metadata: { subscriptionId: sub.id } },
      });
    });

    test("trialing with a card → plan swapped and the trial ended now", async () => {
      const s = await seedTrial();
      withCard();
      const sub = subscription(s.stripeId);
      live = [sub];

      const result = await stripeRouter
        .createCaller(asCaller(s))
        .getCheckoutSession({
          currency: "USD",
          workspaceSlug: s.ws.slug,
          plan: "team",
        });

      expect(result?.type).toBe("updated");
      expect(updateSubscription.mock.calls[0]).toEqual([
        sub.id,
        {
          items: [{ id: "si_plan", price: TEAM_PRICE }],
          proration_behavior: "create_prorations",
          cancel_at_period_end: false,
          trial_end: "now",
          payment_behavior: "error_if_incomplete",
        },
      ]);
      const after = await readWorkspace(s.ws.id);
      expect(after?.plan).toBe("team");
      expect(after?.trialEndsAt).toBeNull();
    });
  });

  describe("addAddon", () => {
    test("trialing without a card → precondition failed", async () => {
      const s = await seedTrial();
      live = [subscription(s.stripeId)];

      await expect(
        stripeRouter.createCaller(asCaller(s)).addAddon({
          workspaceSlug: s.ws.slug,
          feature: "white-label",
          value: true,
        }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(updateSubscription).toHaveBeenCalledTimes(0);
    });

    test("trialing with a card → trial ended before the addon is added", async () => {
      const s = await seedTrial();
      withCard();
      const sub = subscription(s.stripeId);
      live = [sub];
      const planItem = sub.items.data[0];
      const listItems = vi
        .spyOn(stripe.subscriptionItems, "list")
        .mockImplementation(
          () =>
            Promise.resolve({
              data: planItem ? [planItem] : [],
            } as Stripe.Response<
              Stripe.ApiList<Stripe.SubscriptionItem>
            >) as Stripe.ApiListPromise<Stripe.SubscriptionItem>,
        );
      const createItem = vi
        .spyOn(stripe.subscriptionItems, "create")
        .mockImplementation(() =>
          Promise.resolve({} as Stripe.Response<Stripe.SubscriptionItem>),
        );
      stubs.push(listItems, createItem);

      await stripeRouter.createCaller(asCaller(s)).addAddon({
        workspaceSlug: s.ws.slug,
        feature: "white-label",
        value: true,
      });

      expect(updateSubscription.mock.calls[0]).toEqual([
        sub.id,
        { trial_end: "now", payment_behavior: "error_if_incomplete" },
      ]);
      expect(createItem.mock.calls[0]?.[0]).toMatchObject({
        price: WHITE_LABEL_PRICE,
        subscription: sub.id,
      });
      const after = await readWorkspace(s.ws.id);
      expect(after?.trialEndsAt).toBeNull();
      expect(JSON.parse(after?.limits ?? "{}")["white-label"]).toBe(true);
    });

    test("a boolean on a quantity addon is rejected before Stripe is touched", async () => {
      const s = await seedTrial();
      withCard();
      live = [subscription(s.stripeId)];
      const delItem = vi
        .spyOn(stripe.subscriptionItems, "del")
        .mockImplementation(() =>
          Promise.resolve(
            {} as Stripe.Response<Stripe.DeletedSubscriptionItem>,
          ),
        );
      stubs.push(delItem);

      await expect(
        stripeRouter.createCaller(asCaller(s)).addAddon({
          workspaceSlug: s.ws.slug,
          feature: "monitors",
          value: false,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(delItem).toHaveBeenCalledTimes(0);
      expect(updateSubscription).toHaveBeenCalledTimes(0);
    });
  });

  describe("cancelSubscription", () => {
    test("trialing → cancelled immediately", async () => {
      const sub = subscription("cus_cancel_trial");
      live = [sub];

      await cancelSubscription("cus_cancel_trial");

      expect(cancelStripeSubscription.mock.calls[0]?.[0]).toBe(sub.id);
      expect(updateSubscription).toHaveBeenCalledTimes(0);
    });

    test("active → cancelled at period end", async () => {
      const sub = subscription("cus_cancel_active", { status: "active" });
      live = [sub];

      await cancelSubscription("cus_cancel_active");

      expect(cancelStripeSubscription).toHaveBeenCalledTimes(0);
      expect(updateSubscription.mock.calls[0]?.[1]).toMatchObject({
        cancel_at_period_end: true,
      });
    });
  });

  describe("deleteAccount", () => {
    test("a trial is cancelled and the account deleted", async () => {
      const s = await seedTrial();
      const sub = subscription(s.stripeId);
      live = [sub];

      await edgeRouter.createCaller(asCaller(s)).user.deleteAccount();

      expect(cancelStripeSubscription.mock.calls[0]?.[0]).toBe(sub.id);
      const after = await readWorkspace(s.ws.id);
      expect(after?.plan).toBe("free");
      expect(after?.trialEndsAt).toBeNull();
      expect(await lastPlanAuditReason(s.ws.id)).toBe("account_deleted");
      const deleted = await db
        .select()
        .from(user)
        .where(eq(user.id, s.user.id))
        .get();
      expect(deleted?.deletedAt).not.toBeNull();
    });

    test("a paid workspace elsewhere rejects the delete and keeps the trial", async () => {
      const s = await seedTrial();
      live = [subscription(s.stripeId)];
      const paid = await createWorkspace({ plan: "team", trialEndsAt: null });
      await addUserToWorkspace(s.user.id, paid.id, "owner");

      await expect(
        edgeRouter.createCaller(asCaller(s)).user.deleteAccount(),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

      expect(cancelStripeSubscription).toHaveBeenCalledTimes(0);
      const after = await readWorkspace(s.ws.id);
      expect(after?.plan).toBe("starter");
      expect(after?.trialEndsAt).toEqual(s.trialEndsAt);
    });
  });

  describe("webhook", () => {
    const caller = () =>
      webhookRouter.createCaller(createInnerTRPCContext({ session: null }));

    function event(
      type: string,
      object: Stripe.Subscription | Stripe.Checkout.Session,
      previous_attributes?: Partial<Stripe.Subscription>,
    ) {
      return {
        event: {
          id: `evt_${crypto.randomUUID()}`,
          created: now(),
          type,
          data: { object: { ...object }, previous_attributes },
        },
      };
    }

    test("setup checkout completed → card set as the default everywhere", async () => {
      const intent: Partial<Stripe.SetupIntent> = {
        payment_method: "pm_new",
        metadata: { subscriptionId: "sub_setup" },
      };
      const retrieveIntent = vi
        .spyOn(stripe.setupIntents, "retrieve")
        .mockImplementation(() =>
          Promise.resolve(intent as Stripe.Response<Stripe.SetupIntent>),
        );
      const retrieveSub = vi
        .spyOn(stripe.subscriptions, "retrieve")
        .mockImplementation(() =>
          Promise.resolve(
            subscription("cus_setup", {
              id: "sub_setup",
            }) as Stripe.Response<Stripe.Subscription>,
          ),
        );
      const updateCustomer = vi
        .spyOn(stripe.customers, "update")
        .mockImplementation(() =>
          Promise.resolve({} as Stripe.Response<Stripe.Customer>),
        );
      stubs.push(retrieveIntent, retrieveSub, updateCustomer);

      await caller().sessionCompleted(
        event("checkout.session.completed", {
          mode: "setup",
          customer: "cus_setup",
          setup_intent: "seti_1",
        } as Stripe.Checkout.Session),
      );

      expect(updateCustomer.mock.calls[0]).toEqual([
        "cus_setup",
        { invoice_settings: { default_payment_method: "pm_new" } },
      ]);
      expect(updateSubscription.mock.calls[0]).toEqual([
        "sub_setup",
        { default_payment_method: "pm_new" },
      ]);
    });

    function stubSetup() {
      stubs.push(
        vi.spyOn(stripe.setupIntents, "retrieve").mockImplementation(() =>
          Promise.resolve({
            payment_method: "pm_new",
            metadata: { subscriptionId: "sub_setup" },
          } as unknown as Stripe.Response<Stripe.SetupIntent>),
        ),
        vi.spyOn(stripe.subscriptions, "retrieve").mockImplementation(() =>
          Promise.resolve(
            subscription("cus_setup", {
              id: "sub_setup",
            }) as Stripe.Response<Stripe.Subscription>,
          ),
        ),
        vi
          .spyOn(stripe.customers, "update")
          .mockImplementation(() =>
            Promise.resolve({} as Stripe.Response<Stripe.Customer>),
          ),
      );
    }

    const setupCompleted = () =>
      event("checkout.session.completed", {
        mode: "setup",
        customer: "cus_setup",
        setup_intent: "seti_1",
      } as Stripe.Checkout.Session);

    test("setup checkout completed → automatic tax on after the card", async () => {
      stubSetup();

      await caller().sessionCompleted(setupCompleted());

      expect(updateSubscription.mock.calls.map((c) => c)).toEqual([
        ["sub_setup", { default_payment_method: "pm_new" }],
        ["sub_setup", { automatic_tax: { enabled: true } }],
      ]);
    });

    test("Stripe rejecting the tax location still keeps the card", async () => {
      stubSetup();
      stubs = stubs.filter((s) => s !== updateSubscription);
      updateSubscription.mockRestore();
      const update = vi
        .spyOn(stripe.subscriptions, "update")
        .mockImplementation(
          (_id: string, params?: Stripe.SubscriptionUpdateParams) =>
            params?.automatic_tax
              ? Promise.reject(new Error("customer_tax_location_invalid"))
              : Promise.resolve({} as Stripe.Response<Stripe.Subscription>),
        );
      stubs.push(update);

      await caller().sessionCompleted(setupCompleted());

      expect(update.mock.calls[0]).toEqual([
        "sub_setup",
        { default_payment_method: "pm_new" },
      ]);
      expect(update).toHaveBeenCalledTimes(2);
    });

    test("checkout completed with a trial → trial_started, customer stamped", async () => {
      const stripeId = `cus_${crypto.randomUUID()}`;
      const f = await createTestWorkspace({
        plan: "free",
        stripeId,
        subscriptionId: null,
        trialEndsAt: null,
      });
      const sub = subscription(stripeId, {
        metadata: {
          source: "trial_opt_in",
          surface: "billing",
          intent: "Slack alerts",
        },
      });
      const retrieveSub = vi
        .spyOn(stripe.subscriptions, "retrieve")
        .mockImplementation(() =>
          Promise.resolve(sub as Stripe.Response<Stripe.Subscription>),
        );
      const updateCustomer = vi
        .spyOn(stripe.customers, "update")
        .mockImplementation(() =>
          Promise.resolve({} as Stripe.Response<Stripe.Customer>),
        );
      stubs.push(retrieveSub, updateCustomer);
      const session = {
        mode: "subscription",
        customer: stripeId,
        subscription: sub.id,
      } as Stripe.Checkout.Session;

      await caller().sessionCompleted(
        event("checkout.session.completed", session),
      );

      const after = await readWorkspace(f.workspace.id);
      expect(after?.plan).toBe("starter");
      expect(after?.subscriptionId).toBe(sub.id);
      expect(after?.trialEndsAt).toEqual(new Date((sub.trial_end ?? 0) * 1000));
      expect(await lastPlanAuditReason(f.workspace.id)).toBe("trial_started");
      expect(updateCustomer.mock.calls[0]).toEqual([
        stripeId,
        { metadata: { trialed: "true" } },
      ]);

      const trialedAt = await readTrialedAt(f.workspace.id);
      expect(trialedAt).toBeInstanceOf(Date);

      // A redelivered event stamps again and changes nothing else.
      await caller().sessionCompleted(
        event("checkout.session.completed", session),
      );
      expect(updateCustomer).toHaveBeenCalledTimes(2);
      expect((await readWorkspace(f.workspace.id))?.plan).toBe("starter");
      expect(await readTrialedAt(f.workspace.id)).toEqual(trialedAt);
    });

    test("checkout completed with a paid subscription is not a trial", async () => {
      const stripeId = `cus_${crypto.randomUUID()}`;
      const f = await createTestWorkspace({
        plan: "free",
        stripeId,
        subscriptionId: null,
        trialEndsAt: null,
      });
      const sub = subscription(stripeId, { status: "active", trial_end: null });
      const retrieveSub = vi
        .spyOn(stripe.subscriptions, "retrieve")
        .mockImplementation(() =>
          Promise.resolve(sub as Stripe.Response<Stripe.Subscription>),
        );
      const updateCustomer = vi
        .spyOn(stripe.customers, "update")
        .mockImplementation(() =>
          Promise.resolve({} as Stripe.Response<Stripe.Customer>),
        );
      stubs.push(retrieveSub, updateCustomer);

      await caller().sessionCompleted(
        event("checkout.session.completed", {
          mode: "subscription",
          customer: stripeId,
          subscription: sub.id,
        } as Stripe.Checkout.Session),
      );

      expect(await lastPlanAuditReason(f.workspace.id)).toBe(
        "checkout_session_completed",
      );
      expect(updateCustomer).toHaveBeenCalledTimes(0);
      expect(await readTrialedAt(f.workspace.id)).toBeNull();
    });

    test("trialing → active clears trialEndsAt", async () => {
      const s = await seedTrial();
      const sub = subscription(s.stripeId, { status: "active" });
      live = [sub];

      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub, { status: "trialing" }),
      );

      const after = await readWorkspace(s.ws.id);
      expect(after?.plan).toBe("starter");
      expect(after?.trialEndsAt).toBeNull();
    });

    test("a live trial keeps trialEndsAt in sync", async () => {
      const s = await seedTrial();
      const sub = subscription(s.stripeId, { trial_end: now() + 20 * DAY });
      live = [sub];

      await caller().customerSubscriptionUpdated(
        event("customer.subscription.updated", sub),
      );

      const after = await readWorkspace(s.ws.id);
      expect(after?.trialEndsAt).toEqual(new Date((sub.trial_end ?? 0) * 1000));
    });

    test("a trial that ran out is audited as trial_ended, not churn", async () => {
      const send = vi
        .spyOn(resend.emails, "send")
        .mockImplementation(() => undefined as never);
      const enabled = vi
        .spyOn(delivery, "enabled")
        .mockImplementation(() => true);
      stubs.push(send, enabled);
      const s = await seedTrial();
      live = [];

      await caller().customerSubscriptionDeleted(
        event(
          "customer.subscription.deleted",
          subscription(s.stripeId, { status: "canceled" }),
        ),
      );

      const after = await readWorkspace(s.ws.id);
      expect(after?.plan).toBe("free");
      expect(after?.trialEndsAt).toBeNull();
      expect(await lastPlanAuditReason(s.ws.id)).toBe("trial_ended");
    });

    test("a trial the customer cancelled is audited as trial_cancelled", async () => {
      const send = vi
        .spyOn(resend.emails, "send")
        .mockImplementation(() => undefined as never);
      const enabled = vi
        .spyOn(delivery, "enabled")
        .mockImplementation(() => true);
      stubs.push(send, enabled);
      const s = await seedTrial();
      live = [];

      await caller().customerSubscriptionDeleted(
        event(
          "customer.subscription.deleted",
          subscription(s.stripeId, {
            status: "canceled",
            cancellation_details: {
              reason: "cancellation_requested",
            } as Stripe.Subscription.CancellationDetails,
          }),
        ),
      );

      const after = await readWorkspace(s.ws.id);
      expect(after?.plan).toBe("free");
      expect(after?.trialEndsAt).toBeNull();
      expect(await lastPlanAuditReason(s.ws.id)).toBe("trial_cancelled");
    });

    test("cancelled inside the slack after trial_end: card → churn, no card → trial", async () => {
      const send = vi
        .spyOn(resend.emails, "send")
        .mockImplementation(() => undefined as never);
      const enabled = vi
        .spyOn(delivery, "enabled")
        .mockImplementation(() => true);
      stubs.push(send, enabled);
      live = [];
      const trialEnd = now() - 2 * 60 * 60;
      const endedSoonAfter = (stripeId: string) =>
        event(
          "customer.subscription.deleted",
          subscription(stripeId, {
            status: "canceled",
            trial_end: trialEnd,
            ended_at: trialEnd + 30 * 60,
            cancellation_details: {
              reason: "cancellation_requested",
            } as Stripe.Subscription.CancellationDetails,
          }),
        );

      const cardless = await seedTrial();
      await caller().customerSubscriptionDeleted(
        endedSoonAfter(cardless.stripeId),
      );
      expect(await lastPlanAuditReason(cardless.ws.id)).toBe("trial_cancelled");

      withCard();
      const converted = await seedTrial();
      await caller().customerSubscriptionDeleted(
        endedSoonAfter(converted.stripeId),
      );
      expect(await lastPlanAuditReason(converted.ws.id)).toBe(
        "subscription_deleted",
      );
    });

    test("a converted trial cancelled later is churn even if the marker is stale", async () => {
      const send = vi
        .spyOn(resend.emails, "send")
        .mockImplementation(() => undefined as never);
      const enabled = vi
        .spyOn(delivery, "enabled")
        .mockImplementation(() => true);
      stubs.push(send, enabled);
      // The trial-to-active webhook never landed, so `trialEndsAt` is set.
      const s = await seedTrial();
      live = [];
      const trialEnd = now() - 30 * DAY;

      await caller().customerSubscriptionDeleted(
        event(
          "customer.subscription.deleted",
          subscription(s.stripeId, {
            status: "canceled",
            trial_end: trialEnd,
            ended_at: now(),
            cancellation_details: {
              reason: "cancellation_requested",
            } as Stripe.Subscription.CancellationDetails,
          }),
        ),
      );

      const after = await readWorkspace(s.ws.id);
      expect(after?.plan).toBe("free");
      expect(after?.trialEndsAt).toBeNull();
      expect(await lastPlanAuditReason(s.ws.id)).toBe("subscription_deleted");
    });

    test("deleted on an already-free workspace → nothing happens", async () => {
      const send = vi
        .spyOn(resend.emails, "send")
        .mockImplementation(() => undefined as never);
      const enabled = vi
        .spyOn(delivery, "enabled")
        .mockImplementation(() => true);
      stubs.push(send, enabled);
      const stripeId = `cus_${crypto.randomUUID()}`;
      await createTestWorkspace({
        plan: "free",
        stripeId,
        subscriptionId: null,
      });

      await caller().customerSubscriptionDeleted(
        event(
          "customer.subscription.deleted",
          subscription(stripeId, { status: "canceled" }),
        ),
      );

      expect(send).toHaveBeenCalledTimes(0);
    });
  });
});
