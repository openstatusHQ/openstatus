import { Events } from "@openstatus/analytics";
import { workspacePlans } from "@openstatus/db/src/schema";
import type {
  AddonQuantityKey,
  BillingInterval,
} from "@openstatus/db/src/schema/plan/schema";
import {
  addons,
  billingIntervals,
} from "@openstatus/db/src/schema/plan/schema";
import { isAddonQuantityKey } from "@openstatus/db/src/schema/plan/utils";
import {
  ConflictError,
  type ServiceContext,
  countWorkspaceUsage,
} from "@openstatus/services";
import {
  getWorkspace,
  getWorkspaceForMember,
  updateWorkspaceLimits,
  updateWorkspacePlan,
  updateWorkspaceStripeId,
} from "@openstatus/services/workspace";
import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  buildFromSubscriptionOrThrow,
  getCurrentPeriodEnd,
  getCurrentSubscription,
  hasPaymentMethod,
  stripe,
  trialEndsAtOf,
} from "./shared";
import {
  buildPlanChangeItems,
  getPlanFromPriceId,
  getPriceIdForFeature,
  getPriceIdForPlan,
  resolveAddonQuantity,
} from "./utils";

// The addon `title` reads wrong in the "you already have N ..." sentence.
const LIMIT_LABEL: Record<AddonQuantityKey, string> = {
  monitors: "monitors",
  "status-pages": "status pages",
};

const url =
  process.env.NODE_ENV === "production"
    ? "https://www.openstatus.dev"
    : "http://localhost:3000";

// The slug is input, so the target may differ from the active `ctx.workspace`.
async function resolveWorkspaceCtx(opts: {
  ctx: { db: ServiceContext["db"]; user: { id: number } };
  input: { workspaceSlug: string };
}) {
  const access = await getWorkspaceForMember({
    input: { slug: opts.input.workspaceSlug, userId: opts.ctx.user.id },
    db: opts.ctx.db,
  });
  if (!access) return;
  const ctx: ServiceContext = {
    workspace: access.workspace,
    actor: { type: "user", userId: opts.ctx.user.id },
    db: opts.ctx.db,
  };
  return { ctx, email: access.email };
}

async function ensureStripeCustomer(ctx: ServiceContext, email: string | null) {
  if (ctx.workspace.stripeId) return ctx.workspace.stripeId;

  const customer = await stripe.customers.create({
    metadata: { workspaceId: String(ctx.workspace.id) },
    email: email || "",
  });

  try {
    await updateWorkspaceStripeId({ ctx, input: { stripeId: customer.id } });
  } catch (err) {
    if (!(err instanceof ConflictError)) throw err;
    // A concurrent request linked its customer first; ours would orphan.
    await stripe.customers.del(customer.id).catch(() => undefined);
    const linked = await getWorkspace({ ctx });
    if (!linked.stripeId) throw err;
    return linked.stripeId;
  }

  return customer.id;
}

async function createPaymentMethodSetupSession(args: {
  customer: string;
  subscriptionId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe.checkout.sessions.create({
    mode: "setup",
    payment_method_types: ["card"],
    customer: args.customer,
    setup_intent_data: { metadata: { subscriptionId: args.subscriptionId } },
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });
}

export const stripeRouter = createTRPCRouter({
  // The workspace only stores the plan, not the interval it is billed on, so
  // the plan table asks Stripe to tell "Pro monthly" apart from "Pro yearly".
  getBillingInterval: protectedProcedure.query(
    async ({ ctx }): Promise<BillingInterval | null> => {
      const stripeId = ctx.workspace.stripeId;
      if (!stripeId) return null;

      const { current } = await getCurrentSubscription(stripeId);
      const planItem = current?.items.data.find((item) =>
        getPlanFromPriceId(item.price.id),
      );
      const interval = planItem?.price.recurring?.interval;
      if (interval === "year") return "yearly";
      if (interval === "month") return "monthly";
      return null;
    },
  ),

  getUserCustomerPortal: protectedProcedure
    .input(
      z.object({ workspaceSlug: z.string(), returnUrl: z.string().optional() }),
    )
    .mutation(async (opts) => {
      const resolved = await resolveWorkspaceCtx(opts);
      if (!resolved) return;
      const result = resolved.ctx.workspace;
      const stripeId = await ensureStripeCustomer(resolved.ctx, resolved.email);

      const session = await stripe.billingPortal.sessions.create({
        customer: stripeId,
        return_url:
          opts.input.returnUrl || `${url}/app/${result.slug}/settings`,
      });

      return session.url;
    }),

  getCheckoutSession: protectedProcedure
    .input(
      z.object({
        currency: z.string(),
        workspaceSlug: z.string(),
        plan: z.enum(workspacePlans),
        interval: z.enum(billingIntervals).default("monthly"),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
      }),
    )
    .mutation(async (opts) => {
      const resolved = await resolveWorkspaceCtx(opts);
      if (!resolved) return;
      const result = resolved.ctx.workspace;
      const stripeId = await ensureStripeCustomer(resolved.ctx, resolved.email);

      const priceId = getPriceIdForPlan(opts.input.plan, opts.input.interval);
      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid plan",
        });
      }

      // A customer who already pays gets the plan swapped on the subscription
      // they have. Sending them back through checkout would open a *second*
      // subscription: both would bill until some unrelated webhook happened to
      // retire one, the addon line items would stay behind on the old one, and
      // the workspace would be rebuilt from a plan-only subscription — silently
      // dropping every addon they bought.
      const { current } = await getCurrentSubscription(stripeId);

      const billingUrl = `${url}/app/${result.slug}/settings/billing`;
      const isTrialing = current?.status === "trialing";
      const trialWithoutCard =
        current !== undefined &&
        isTrialing &&
        !(await hasPaymentMethod(current));

      if (
        trialWithoutCard &&
        opts.input.plan === "starter" &&
        opts.input.interval === "monthly"
      ) {
        const session = await createPaymentMethodSetupSession({
          customer: stripeId,
          subscriptionId: current.id,
          successUrl: opts.input.successUrl || `${billingUrl}?setup=true`,
          cancelUrl: opts.input.cancelUrl || billingUrl,
        });
        return { type: "setup" as const, session };
      }

      // A trial without a card cannot be charged in place, so it goes through
      // a regular checkout; `sessionCompleted` retires the trial subscription.
      if (current && !trialWithoutCard) {
        const planItem = current.items.data.find((item) =>
          getPlanFromPriceId(item.price.id),
        );

        if (!planItem) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Your subscription is on a legacy price and cannot be changed here. Contact us and we will move it for you.",
          });
        }

        let items: Stripe.SubscriptionUpdateParams.Item[];
        try {
          items = buildPlanChangeItems({
            subscription: current,
            planItemId: planItem.id,
            planPriceId: priceId,
            interval: opts.input.interval,
          });
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Your subscription has an add-on that cannot be moved to this billing interval. Contact us and we will switch it for you.",
          });
        }

        // Classify before mutating Stripe. An item on a price neither table
        // knows throws, and throwing *after* the update would leave the
        // customer re-priced and billed while the workspace kept the old plan
        // — a split the webhook cannot repair either, since it throws on the
        // same item.
        buildFromSubscriptionOrThrow(current);

        // Every existing item is listed by id, so Stripe re-prices it in place
        // instead of dropping it, and the addons survive the change. Clearing
        // `cancel_at_period_end` resumes a subscription the customer had
        // scheduled to cancel — choosing a paid plan says they mean to keep
        // paying.
        const updated = await stripe.subscriptions.update(current.id, {
          items,
          proration_behavior: "create_prorations",
          cancel_at_period_end: false,
          ...(isTrialing && {
            trial_end: "now",
            payment_behavior: "error_if_incomplete",
          }),
        });

        const built = buildFromSubscriptionOrThrow(updated);

        if (!built) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid plan",
          });
        }

        // Sync here rather than waiting on `customer.subscription.updated`, so
        // the workspace the dashboard refetches is already correct. The webhook
        // rebuilds the same state from the same subscription, so applying it
        // again is a no-op.
        await updateWorkspacePlan({
          ctx: resolved.ctx,
          input: {
            plan: built.plan,
            subscriptionId: updated.id,
            endsAt: getCurrentPeriodEnd(updated),
            paidUntil: getCurrentPeriodEnd(updated),
            trialEndsAt: trialEndsAtOf(updated),
            limits: built.limits,
            reason: "plan_changed",
          },
        });

        return { type: "updated" as const };
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        currency: opts.input.currency,
        customer: stripeId,
        customer_update: {
          name: "auto",
          address: "auto",
        },
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        tax_id_collection: {
          enabled: true,
        },
        mode: "subscription",
        success_url: opts.input.successUrl || `${billingUrl}?success=true`,
        cancel_url: opts.input.cancelUrl || billingUrl,
      });

      return { type: "checkout" as const, session };
    }),

  getPaymentMethodSetupSession: protectedProcedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
      }),
    )
    .mutation(async (opts) => {
      const resolved = await resolveWorkspaceCtx(opts);
      const ws = resolved?.ctx.workspace;
      if (!ws?.stripeId) return;

      const { current } = await getCurrentSubscription(ws.stripeId);
      if (!current) return;

      const billingUrl = `${url}/app/${ws.slug}/settings/billing`;
      const session = await createPaymentMethodSetupSession({
        customer: ws.stripeId,
        subscriptionId: current.id,
        successUrl: opts.input.successUrl || `${billingUrl}?setup=true`,
        cancelUrl: opts.input.cancelUrl || billingUrl,
      });

      return session.url;
    }),

  addAddon: protectedProcedure
    .meta({ track: Events.AddFeature, trackProps: ["feature"] })
    .input(
      z
        .object({
          workspaceSlug: z.string(),
          feature: z.enum(addons),
          value: z.union([z.boolean(), z.number()]),
        })
        // A boolean on a quantity addon (or a number on a toggle) would change
        // the Stripe item but leave the limit untouched, so reject it up front.
        .refine(
          (i) =>
            (typeof i.value === "number") === isAddonQuantityKey(i.feature),
          { message: "Value does not match the addon type", path: ["value"] },
        ),
    )
    .mutation(async (opts) => {
      const resolved = await resolveWorkspaceCtx(opts);
      if (!resolved) return;
      const ws = resolved.ctx.workspace;

      const stripeId = ws.stripeId;
      if (!stripeId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workspace has no Stripe ID",
        });
      }

      // Same "which subscription is current" rule as the plan change and the
      // webhooks. `customers.retrieve(expand: ["subscriptions"])` also returns
      // the `incomplete` records an abandoned checkout leaves behind, and
      // taking the first of those would attach the addon to a subscription
      // that never bills — granting the limit for free until a later webhook
      // rebuilt it away.
      const { current } = await getCurrentSubscription(stripeId);

      if (!current) {
        return;
      }

      const isTrialing = current.status === "trialing";
      const isRemoval = opts.input.value === false || opts.input.value === 0;
      // Removing an addon never ends the trial, so it needs no card.
      if (isTrialing && !isRemoval && !(await hasPaymentMethod(current))) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Add a payment method first.",
        });
      }

      const items = await stripe.subscriptionItems.list({
        subscription: current.id,
        limit: 100,
      });

      // Stripe rejects mixed billing intervals on one subscription, so the
      // addon is billed on the same interval as the plan.
      const planItem = items.data.find((item) =>
        getPlanFromPriceId(item.price.id),
      );
      const isYearly = planItem?.price.recurring?.interval === "year";
      const priceId = getPriceIdForFeature(
        opts.input.feature,
        isYearly ? "yearly" : "monthly",
      );

      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid feature",
        });
      }

      let quantity = 1;
      let newValue: boolean | number = opts.input.value;

      if (typeof opts.input.value === "number") {
        let resolved: ReturnType<typeof resolveAddonQuantity>;
        try {
          resolved = resolveAddonQuantity({
            addon: opts.input.feature,
            plan: ws.plan,
            packs: opts.input.value,
          });
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e instanceof Error ? e.message : "Invalid quantity",
          });
        }

        quantity = resolved.quantity;
        newValue = resolved.newLimit;

        if (!isAddonQuantityKey(opts.input.feature)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid feature",
          });
        }

        const current = await countWorkspaceUsage(
          opts.ctx.db,
          ws.id,
          opts.input.feature,
        );
        if (current > resolved.newLimit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `You already have ${current} ${LIMIT_LABEL[opts.input.feature]}, please delete some first.`,
          });
        }
      }

      const item = items.data.find((item) => item.price.id === priceId);

      // Charge the plan before granting the addon, so a declined card leaves
      // the trial and the limits untouched.
      const endsTrial = isTrialing && !isRemoval;
      if (endsTrial) {
        await stripe.subscriptions.update(current.id, {
          trial_end: "now",
          payment_behavior: "error_if_incomplete",
        });
      }

      if (isRemoval) {
        if (item) {
          await stripe.subscriptionItems.del(item.id);
        }
      } else if (item) {
        await stripe.subscriptionItems.update(item.id, {
          quantity,
        });
      } else {
        await stripe.subscriptionItems.create({
          price: priceId,
          subscription: current.id,
          quantity,
        });
      }

      await updateWorkspaceLimits({
        ctx: resolved.ctx,
        input: {
          addon: opts.input.feature,
          value: newValue,
          ...(endsTrial && { trialEndsAt: null }),
          reason: endsTrial ? "trial_converted" : "addon_changed",
        },
      });

      // TODO: send email to user notifying about the change if not already from stripe

      return;
    }),
});
