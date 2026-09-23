import { db, eq } from "@openstatus/db";
import {
  selectUserSchema,
  selectWorkspaceSchema,
  user,
  workspace,
} from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { delivery, resend } from "@openstatus/emails/src/send";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";
import type Stripe from "stripe";

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

function asCaller(fixture: Awaited<ReturnType<typeof seedTrial>>) {
  return createInnerTRPCContext({
    session: { user: { id: String(fixture.user.id) } },
    workspace: fixture.ws,
    user: selectUserSchema.parse(fixture.user),
  });
}

describe("trial lifecycle", () => {
  let live: Stripe.Subscription[];
  let customer: Stripe.Customer;
  let stubs: Stub[];
  let updateSubscription: Stub;
  let cancelStripeSubscription: Stub;
  let createSession: Stub;

  beforeEach(() => {
    live = [];
    customer = customerWith(null);
    updateSubscription = stub(
      stripe.subscriptions,
      "update",
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
    cancelStripeSubscription = stub(stripe.subscriptions, "cancel", () =>
      Promise.resolve({} as Stripe.Response<Stripe.Subscription>),
    );
    createSession = stub(stripe.checkout.sessions, "create", () =>
      Promise.resolve({
        url: "https://checkout.stripe.test/session",
      } as Stripe.Response<Stripe.Checkout.Session>),
    );
    stubs = [
      updateSubscription,
      cancelStripeSubscription,
      createSession,
      stub(
        stripe.subscriptions,
        "list",
        () =>
          ({
            autoPagingToArray: (_opts: { limit: number }) =>
              Promise.resolve(live),
          }) as Stripe.ApiListPromise<Stripe.Subscription>,
      ),
      stub(stripe.customers, "retrieve", () =>
        Promise.resolve(customer as Stripe.Response<Stripe.Customer>),
      ),
    ];
  });

  afterEach(() => {
    for (const s of stubs) s.restore();
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
      assertSpyCalls(updateSubscription, 0);
      expect(createSession.calls[0]?.args[0]).toMatchObject({
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
      expect(createSession.calls[0]?.args[0]).toMatchObject({
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
      expect(updateSubscription.calls[0]?.args).toEqual([
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
      assertSpyCalls(updateSubscription, 0);
    });

    test("trialing with a card → trial ended before the addon is added", async () => {
      const s = await seedTrial();
      withCard();
      const sub = subscription(s.stripeId);
      live = [sub];
      const planItem = sub.items.data[0];
      const listItems = stub(
        stripe.subscriptionItems,
        "list",
        () =>
          Promise.resolve({
            data: planItem ? [planItem] : [],
          } as Stripe.Response<
            Stripe.ApiList<Stripe.SubscriptionItem>
          >) as Stripe.ApiListPromise<Stripe.SubscriptionItem>,
      );
      const createItem = stub(stripe.subscriptionItems, "create", () =>
        Promise.resolve({} as Stripe.Response<Stripe.SubscriptionItem>),
      );
      stubs.push(listItems, createItem);

      await stripeRouter.createCaller(asCaller(s)).addAddon({
        workspaceSlug: s.ws.slug,
        feature: "white-label",
        value: true,
      });

      expect(updateSubscription.calls[0]?.args).toEqual([
        sub.id,
        { trial_end: "now", payment_behavior: "error_if_incomplete" },
      ]);
      expect(createItem.calls[0]?.args[0]).toMatchObject({
        price: WHITE_LABEL_PRICE,
        subscription: sub.id,
      });
      const after = await readWorkspace(s.ws.id);
      expect(after?.trialEndsAt).toBeNull();
      expect(JSON.parse(after?.limits ?? "{}")["white-label"]).toBe(true);
    });
  });

  describe("cancelSubscription", () => {
    test("trialing → cancelled immediately", async () => {
      const sub = subscription("cus_cancel_trial");
      live = [sub];

      await cancelSubscription("cus_cancel_trial");

      expect(cancelStripeSubscription.calls[0]?.args[0]).toBe(sub.id);
      assertSpyCalls(updateSubscription, 0);
    });

    test("active → cancelled at period end", async () => {
      const sub = subscription("cus_cancel_active", { status: "active" });
      live = [sub];

      await cancelSubscription("cus_cancel_active");

      assertSpyCalls(cancelStripeSubscription, 0);
      expect(updateSubscription.calls[0]?.args[1]).toMatchObject({
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

      expect(cancelStripeSubscription.calls[0]?.args[0]).toBe(sub.id);
      const after = await readWorkspace(s.ws.id);
      expect(after?.plan).toBe("free");
      expect(after?.trialEndsAt).toBeNull();
      const deleted = await db
        .select()
        .from(user)
        .where(eq(user.id, s.user.id))
        .get();
      expect(deleted?.deletedAt).not.toBeNull();
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
      const retrieveIntent = stub(stripe.setupIntents, "retrieve", () =>
        Promise.resolve(intent as Stripe.Response<Stripe.SetupIntent>),
      );
      const retrieveSub = stub(stripe.subscriptions, "retrieve", () =>
        Promise.resolve(
          subscription("cus_setup", {
            id: "sub_setup",
          }) as Stripe.Response<Stripe.Subscription>,
        ),
      );
      const updateCustomer = stub(stripe.customers, "update", () =>
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

      expect(updateCustomer.calls[0]?.args).toEqual([
        "cus_setup",
        { invoice_settings: { default_payment_method: "pm_new" } },
      ]);
      expect(updateSubscription.calls[0]?.args).toEqual([
        "sub_setup",
        { default_payment_method: "pm_new" },
      ]);
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

    test("deleted on an already-free workspace → nothing happens", async () => {
      const send = stub(resend.emails, "send");
      const enabled = stub(delivery, "enabled", () => true);
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

      assertSpyCalls(send, 0);
    });
  });
});
