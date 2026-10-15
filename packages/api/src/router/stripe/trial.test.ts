import { db, eq } from "@openstatus/db";
import {
  account,
  selectUserSchema,
  selectWorkspaceSchema,
  user,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createTestWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, type Stub, stub } from "@std/testing/mock";
import type Stripe from "stripe";

import { createInnerTRPCContext } from "../../trpc";
import { workspaceRouter } from "../workspace";
import { stripeRouter } from "./index";
import { stripe } from "./shared";
import { TRIAL_DAYS } from "./trial";
import { PLANS } from "./utils";

const STARTER_PRICE = PLANS.find((p) => p.plan === "starter")?.price.monthly
  .priceIds.test;

type Fixture = Awaited<ReturnType<typeof createTestWorkspace>>;

function asCaller(fixture: Fixture, userId = fixture.user.id) {
  const ws = selectWorkspaceSchema.parse(fixture.workspace);
  return stripeRouter.createCaller(
    createInnerTRPCContext({
      session: { user: { id: String(userId) } },
      workspace: ws,
      user: selectUserSchema.parse({ ...fixture.user, id: userId }),
    }),
  );
}

async function link(userId: number, provider: string) {
  await db.insert(account).values({
    userId,
    type: "oauth",
    provider,
    providerAccountId: crypto.randomUUID(),
  });
}

async function freeWorkspace(
  overrides: Parameters<typeof createTestWorkspace>[0] = {},
  providers: string[] = ["github"],
) {
  const fixture = await createTestWorkspace({
    plan: "free",
    stripeId: null,
    subscriptionId: null,
    trialEndsAt: null,
    ...overrides,
  });
  for (const provider of providers) await link(fixture.user.id, provider);
  return fixture;
}

function customer(id: string, metadata: Record<string, string> = {}) {
  return { id, metadata } as unknown as Stripe.Customer;
}

function trialInput(fixture: Fixture, extra: Record<string, unknown> = {}) {
  return {
    trial: true,
    plan: "starter" as const,
    interval: "monthly" as const,
    currency: "USD",
    workspaceSlug: fixture.workspace.slug,
    ...extra,
  };
}

describe("trial checkout", () => {
  let customerId: string;
  let customers: Stripe.Customer[];
  let subscriptions: Partial<Stripe.Subscription>[];
  let stubs: Stub[];
  let listCustomers: Stub;
  let createCustomer: Stub;
  let createSession: Stub;

  beforeEach(() => {
    customerId = `cus_${crypto.randomUUID()}`;
    customers = [];
    subscriptions = [];
    listCustomers = stub(
      stripe.customers,
      "list",
      () =>
        Promise.resolve({ data: customers } as Stripe.Response<
          Stripe.ApiList<Stripe.Customer>
        >) as Stripe.ApiListPromise<Stripe.Customer>,
    );
    createCustomer = stub(stripe.customers, "create", () =>
      Promise.resolve({ id: customerId } as Stripe.Response<Stripe.Customer>),
    );
    createSession = stub(stripe.checkout.sessions, "create", () =>
      Promise.resolve({
        url: "https://checkout.stripe.test/session",
      } as Stripe.Response<Stripe.Checkout.Session>),
    );
    stubs = [
      listCustomers,
      createCustomer,
      createSession,
      stub(
        stripe.subscriptions,
        "list",
        // Awaited for the eligibility scan, auto-paged for the live lookup.
        () =>
          Object.assign(Promise.resolve({ data: subscriptions }), {
            autoPagingToArray: () => Promise.resolve([]),
          }) as unknown as Stripe.ApiListPromise<Stripe.Subscription>,
      ),
    ];
  });

  afterEach(() => {
    for (const s of stubs) s.restore();
  });

  describe("getCheckoutSession", () => {
    test("opens a card-less Starter trial checkout", async () => {
      const f = await freeWorkspace();

      const result = await asCaller(f).getCheckoutSession(
        trialInput(f, { surface: "billing", intent: "  Slack alerts  " }),
      );

      expect(result?.type).toBe("checkout");
      assertSpyCalls(createCustomer, 1);
      assertSpyCalls(createSession, 1);
      const params = createSession.calls[0]?.args[0];
      expect(params).toMatchObject({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: STARTER_PRICE, quantity: 1 }],
        payment_method_collection: "if_required",
        subscription_data: {
          trial_period_days: TRIAL_DAYS,
          trial_settings: {
            end_behavior: { missing_payment_method: "cancel" },
          },
          metadata: {
            source: "trial_opt_in",
            surface: "billing",
            intent: "Slack alerts",
          },
        },
      });
      expect(params?.success_url).toContain("?trial=true");
    });

    test("omits an empty intent and surface", async () => {
      const f = await freeWorkspace();

      await asCaller(f).getCheckoutSession(trialInput(f, { intent: "   " }));

      expect(
        createSession.calls[0]?.args[0]?.subscription_data?.metadata,
      ).toEqual({ source: "trial_opt_in" });
    });

    test("a regular checkout carries no trial parameters", async () => {
      const f = await freeWorkspace();

      await asCaller(f).getCheckoutSession({
        currency: "USD",
        workspaceSlug: f.workspace.slug,
        plan: "team",
      });

      const params = createSession.calls[0]?.args[0];
      expect(params?.payment_method_collection).toBeUndefined();
      expect(params?.subscription_data).toBeUndefined();
      expect(params?.success_url).toContain("?success=true");
    });

    test("reuses the customer an abandoned checkout left behind", async () => {
      const stripeId = `cus_${crypto.randomUUID()}`;
      const f = await freeWorkspace({ stripeId });
      subscriptions = [{ status: "incomplete_expired" }];

      const result = await asCaller(f).getCheckoutSession(trialInput(f));

      expect(result?.type).toBe("checkout");
      assertSpyCalls(createCustomer, 0);
      expect(createSession.calls[0]?.args[0]).toMatchObject({
        customer: stripeId,
      });
    });

    test("refuses a customer that ever had a subscription", async () => {
      const f = await freeWorkspace({ stripeId: `cus_${crypto.randomUUID()}` });
      subscriptions = [{ status: "canceled" }];

      await expect(
        asCaller(f).getCheckoutSession(trialInput(f)),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "This workspace has already had a subscription.",
      });
      assertSpyCalls(createSession, 0);
    });

    test("refuses a magic-link-only account", async () => {
      const f = await freeWorkspace({}, ["resend"]);

      await expect(
        asCaller(f).getCheckoutSession(trialInput(f)),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Sign in with GitHub or Google to start a trial.",
      });
      assertSpyCalls(listCustomers, 0);
      assertSpyCalls(createCustomer, 0);
    });

    test("refuses an SSO-only account", async () => {
      const f = await freeWorkspace({}, ["workos"]);

      await expect(
        asCaller(f).getCheckoutSession(trialInput(f)),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Trials are not available for SSO accounts.",
      });
      assertSpyCalls(createCustomer, 0);
    });

    test("an account linked to both GitHub and a magic link qualifies", async () => {
      const f = await freeWorkspace({}, ["resend", "github"]);

      const result = await asCaller(f).getCheckoutSession(trialInput(f));

      expect(result?.type).toBe("checkout");
    });

    test("refuses a disposable email", async () => {
      const f = await freeWorkspace();
      await db
        .update(user)
        .set({ email: `someone-${f.user.id}@mailinator.com` })
        .where(eq(user.id, f.user.id));

      await expect(
        asCaller(f).getCheckoutSession(trialInput(f)),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      assertSpyCalls(listCustomers, 0);
    });

    test("refuses an email that already had a trial", async () => {
      const f = await freeWorkspace();
      customers = [
        customer("cus_paid"),
        customer("cus_old", { trialed: "true" }),
      ];

      await expect(
        asCaller(f).getCheckoutSession(trialInput(f)),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "This workspace or email has already used a trial.",
      });
      expect(listCustomers.calls[0]?.args[0]).toEqual({
        email: f.user.email,
        limit: 100,
      });
      assertSpyCalls(createCustomer, 0);
    });

    test("checks both spellings of a mixed-case email", async () => {
      const f = await freeWorkspace();
      const email = `Someone-${f.user.id}@Example.com`;
      await db.update(user).set({ email }).where(eq(user.id, f.user.id));

      await asCaller(f).getCheckoutSession(trialInput(f));

      expect(listCustomers.calls.map((c) => c.args[0])).toEqual([
        { email, limit: 100 },
        { email: email.toLowerCase(), limit: 100 },
      ]);
    });

    test("refuses a workspace that already trialed, before asking Stripe", async () => {
      const f = await freeWorkspace({ trialedAt: new Date() });

      await expect(
        asCaller(f).getCheckoutSession(trialInput(f)),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "This workspace or email has already used a trial.",
      });
      assertSpyCalls(listCustomers, 0);
    });

    test("refuses a member who is not the owner", async () => {
      const f = await freeWorkspace();
      const member = await createUser();
      await addUserToWorkspace(member.id, f.workspace.id, "member");
      await link(member.id, "github");

      await expect(
        asCaller(f, member.id).getCheckoutSession(trialInput(f)),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Only the owner of a free workspace can start a trial.",
      });
    });

    test("refuses a paid workspace", async () => {
      const f = await freeWorkspace({ plan: "team" });

      await expect(
        asCaller(f).getCheckoutSession(trialInput(f)),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      assertSpyCalls(createCustomer, 0);
    });

    test("refuses a trial on any plan but Starter monthly", async () => {
      const f = await freeWorkspace();

      await expect(
        asCaller(f).getCheckoutSession(trialInput(f, { plan: "team" })),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        asCaller(f).getCheckoutSession(trialInput(f, { interval: "yearly" })),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      assertSpyCalls(createSession, 0);
    });
  });

  describe("workspace.get trial", () => {
    function getWorkspace(fixture: Fixture) {
      return workspaceRouter
        .createCaller(
          createInnerTRPCContext({
            session: { user: { id: String(fixture.user.id) } },
            workspace: selectWorkspaceSchema.parse(fixture.workspace),
            user: selectUserSchema.parse(fixture.user),
          }),
        )
        .get();
    }

    test("eligible for an owner signed in with GitHub, without Stripe", async () => {
      const f = await freeWorkspace();
      customers = [customer("cus_old", { trialed: "true" })];

      expect((await getWorkspace(f)).trial).toEqual({
        eligible: true,
      });
      assertSpyCalls(listCustomers, 0);
    });

    test("not eligible once the workspace has trialed", async () => {
      const f = await freeWorkspace({ trialedAt: new Date() });

      expect((await getWorkspace(f)).trial).toEqual({
        eligible: false,
        reason: "already_trialed",
      });
    });

    test("names the reason otherwise", async () => {
      const f = await freeWorkspace({}, ["resend"]);

      expect((await getWorkspace(f)).trial).toEqual({
        eligible: false,
        reason: "email",
      });
    });
  });
});
