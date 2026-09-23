import { db, eq } from "@openstatus/db";
import { invitation, workspace } from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";
import type Stripe from "stripe";

import { stripe } from "./shared";
import { TRIAL_DAYS, maybeStartSignupTrial } from "./trial";
import { PLANS } from "./utils";

const STARTER_PRICE = PLANS.find((p) => p.plan === "starter")?.price.monthly
  .priceIds.test;
const trialEnd = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 86_400;

async function freeWorkspace() {
  return createTestWorkspace({ plan: "free", stripeId: null });
}

describe("maybeStartSignupTrial", () => {
  let customerId: string;
  let searchResult: Stripe.Customer[];
  let price: Partial<Stripe.Price>;
  let stubs: Stub[];
  let search: Stub;
  let createCustomer: Stub;
  let createSubscription: Stub;

  beforeEach(() => {
    customerId = `cus_${crypto.randomUUID()}`;
    searchResult = [];
    price = { currency: "usd", currency_options: {} };
    search = stub(
      stripe.customers,
      "search",
      () =>
        Promise.resolve({ data: searchResult } as Stripe.Response<
          Stripe.ApiSearchResult<Stripe.Customer>
        >) as Stripe.ApiSearchResultPromise<Stripe.Customer>,
    );
    createCustomer = stub(stripe.customers, "create", () =>
      Promise.resolve({ id: customerId } as Stripe.Response<Stripe.Customer>),
    );
    createSubscription = stub(stripe.subscriptions, "create", () =>
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
      search,
      createCustomer,
      createSubscription,
      stub(stripe.prices, "retrieve", () =>
        Promise.resolve(price as Stripe.Response<Stripe.Price>),
      ),
    ];
  });

  afterEach(() => {
    for (const s of stubs) s.restore();
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

    assertSpyCalls(createCustomer, 1);
    expect(createCustomer.calls[0]?.args).toEqual([
      {
        email: user.email,
        metadata: { workspaceId: String(ws.id), trialed: "true" },
      },
      { idempotencyKey: `trial-customer:ws_${ws.id}` },
    ]);

    assertSpyCalls(createSubscription, 1);
    const [params, options] = createSubscription.calls[0]?.args ?? [];
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

    expect(createSubscription.calls[0]?.args[0]).toMatchObject({
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
    assertSpyCalls(createCustomer, 0);
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
    assertSpyCalls(createCustomer, 0);
  });

  test("skips disposable email domains", async () => {
    const { user } = await freeWorkspace();

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: "someone@mailinator.com",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "disposable" });
    assertSpyCalls(search, 0);
  });

  test("skips emails that already had a trial", async () => {
    const { user } = await freeWorkspace();
    searchResult = [{ id: "cus_old" } as Stripe.Customer];

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: "O'Brien@example.com",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "already_trialed" });
    expect(search.calls[0]?.args[0]).toEqual({
      query: "email:'o\\'brien@example.com' AND metadata['trialed']:'true'",
      limit: 1,
    });
    assertSpyCalls(createCustomer, 0);
  });

  test("leaves an already-billed workspace alone", async () => {
    const { user } = await createTestWorkspace({ plan: "team" });

    const result = await maybeStartSignupTrial({
      userId: user.id,
      email: user.email ?? "",
      currency: "USD",
    });

    expect(result).toEqual({ started: false, reason: "not_eligible" });
    assertSpyCalls(createCustomer, 0);
  });
});
