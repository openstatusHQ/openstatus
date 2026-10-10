import { db, eq } from "@openstatus/db";
import { invitation, workspace } from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
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

import { stripe } from "./shared";
import { TRIAL_DAYS, maybeStartSignupTrial } from "./trial";
import { PLANS } from "./utils";

const STARTER_PRICE = PLANS.find((p) => p.plan === "starter")?.price.monthly
  .priceIds.test;
const trialEnd = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 86_400;

async function freeWorkspace() {
  return createTestWorkspace({ plan: "free", stripeId: null });
}

function customer(id: string, metadata: Record<string, string> = {}) {
  return { id, metadata } as unknown as Stripe.Customer;
}

describe("maybeStartSignupTrial", () => {
  let customerId: string;
  let customers: Stripe.Customer[];
  let price: Partial<Stripe.Price>;
  let stubs: MockInstance[];
  let list: MockInstance;
  let createCustomer: MockInstance;
  let createSubscription: MockInstance;
  // Runs inside `customers.create`, to interleave work with the Stripe call.
  let onCreateCustomer: (() => Promise<void>) | undefined;

  beforeEach(() => {
    customerId = `cus_${crypto.randomUUID()}`;
    customers = [];
    onCreateCustomer = undefined;
    price = { currency: "usd", currency_options: {} };
    list = vi
      .spyOn(stripe.customers, "list")
      .mockImplementation(
        () =>
          Promise.resolve({ data: customers } as Stripe.Response<
            Stripe.ApiList<Stripe.Customer>
          >) as Stripe.ApiListPromise<Stripe.Customer>,
      );
    createCustomer = vi
      .spyOn(stripe.customers, "create")
      .mockImplementation(async () => {
        await onCreateCustomer?.();
        return { id: customerId } as Stripe.Response<Stripe.Customer>;
      });
    createSubscription = vi
      .spyOn(stripe.subscriptions, "create")
      .mockImplementation(() =>
        Promise.resolve({
          id: "sub_trial",
          status: "trialing",
          trial_end: trialEnd,
          items: {
            data: [
              {
                price: { id: STARTER_PRICE },
                quantity: 1,
                current_period_end: trialEnd,
              },
            ],
          },
        } as Stripe.Response<Stripe.Subscription>),
      );
    stubs = [
      list,
      createCustomer,
      createSubscription,
      vi
        .spyOn(stripe.prices, "retrieve")
        .mockImplementation(() =>
          Promise.resolve(price as Stripe.Response<Stripe.Price>),
        ),
    ];
  });

  afterEach(() => {
    for (const s of stubs) s.mockRestore();
  });

  test("starts a Starter trial on the owner's workspace", async () => {
    const { workspace: ws, user } = await freeWorkspace();
    price = {
      currency: "usd",
      currency_options: {
        eur: {} as Stripe.Price.CurrencyOptions,
      },
    };

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: user.email ?? "",
      provider: "github",
      currency: "EUR",
    });

    const trialEndsAt = new Date(trialEnd * 1000);
    expect(result).toEqual({ started: true, trialEndsAt });

    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(createCustomer.mock.calls[0]).toEqual([
      {
        email: user.email,
        metadata: { workspaceId: String(ws.id), trialed: "true" },
      },
      { idempotencyKey: `trial-customer:ws_${ws.id}` },
    ]);

    expect(createSubscription).toHaveBeenCalledTimes(1);
    const [params, options] = createSubscription.mock.calls[0] ?? [];
    expect(params).toMatchObject({
      customer: customerId,
      currency: "eur",
      items: [{ price: STARTER_PRICE }],
      trial_period_days: TRIAL_DAYS,
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    });
    expect(options).toEqual({ idempotencyKey: `trial-sub:ws_${ws.id}` });

    const after = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, ws.id))
      .get();
    expect(after?.plan).toBe("starter");
    expect(after?.stripeId).toBe(customerId);
    expect(after?.subscriptionId).toBe("sub_trial");
    expect(after?.trialEndsAt).toEqual(trialEndsAt);
    expect(after?.endsAt).toEqual(trialEndsAt);
    expect(JSON.parse(after?.limits ?? "{}")).toEqual(getLimits("starter"));
  });

  test("falls back to the price currency when the requested one is missing", async () => {
    const { user } = await freeWorkspace();
    price = { currency: "eur", currency_options: {} };

    await maybeStartSignupTrial({
      userId: user.id,
      email: user.email ?? "",
      currency: "USD",
    });

    expect(createSubscription.mock.calls[0]?.[0]).toMatchObject({
      currency: "eur",
    });
  });

  test("skips SSO sign-ins", async () => {
    const { user } = await freeWorkspace();

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: user.email ?? "",
      provider: "workos",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "sso" });
    expect(createCustomer).toHaveBeenCalledTimes(0);
  });

  test("skips magic-link sign-ins", async () => {
    const { user } = await freeWorkspace();

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: user.email ?? "",
      provider: "resend",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "email" });
    expect(createCustomer).toHaveBeenCalledTimes(0);
  });

  test("skips users with a pending invitation", async () => {
    const { workspace: ws, user } = await freeWorkspace();
    await db.insert(invitation).values({
      email: (user.email ?? "").toUpperCase(),
      workspaceId: ws.id,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: user.email ?? "",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "invited" });
    expect(createCustomer).toHaveBeenCalledTimes(0);
  });

  test("skips disposable email domains", async () => {
    const { user } = await freeWorkspace();

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: "someone@mailinator.com",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "disposable" });
    expect(list).toHaveBeenCalledTimes(0);
  });

  test("skips emails that already had a trial", async () => {
    const { user } = await freeWorkspace();
    customers = [
      customer("cus_paid"),
      customer("cus_old", { trialed: "true" }),
    ];

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: "O'Brien@example.com",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "already_trialed" });
    expect(list.mock.calls[0]?.[0]).toEqual({
      email: "o'brien@example.com",
      limit: 100,
    });
    expect(createCustomer).toHaveBeenCalledTimes(0);
  });

  test("ignores customers for the email that never trialed", async () => {
    const { user } = await freeWorkspace();
    customers = [customer("cus_paid")];

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: user.email ?? "",
      currency: "USD",
    });

    expect(result).toMatchObject({ started: true });
    expect(createCustomer).toHaveBeenCalledTimes(1);
  });

  test("drops its customer when another request linked one first", async () => {
    const { workspace: ws, user } = await freeWorkspace();
    const linked = `cus_${crypto.randomUUID()}`;
    // Simulate the race: a checkout links its customer while ours is created.
    onCreateCustomer = async () => {
      await db
        .update(workspace)
        .set({ stripeId: linked })
        .where(eq(workspace.id, ws.id));
    };
    const delCustomer = vi
      .spyOn(stripe.customers, "del")
      .mockImplementation(() =>
        Promise.resolve({} as Stripe.Response<Stripe.DeletedCustomer>),
      );
    stubs.push(delCustomer);

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: user.email ?? "",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "not_eligible" });
    expect(delCustomer.mock.calls[0]?.[0]).toBe(customerId);
    expect(createSubscription).toHaveBeenCalledTimes(0);
    const after = await db
      .select({ stripeId: workspace.stripeId })
      .from(workspace)
      .where(eq(workspace.id, ws.id))
      .get();
    expect(after?.stripeId).toBe(linked);
  });

  test("leaves an already-billed workspace alone", async () => {
    const { user } = await createTestWorkspace({ plan: "team" });

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: user.email ?? "",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "not_eligible" });
    expect(createCustomer).toHaveBeenCalledTimes(0);
  });
});
