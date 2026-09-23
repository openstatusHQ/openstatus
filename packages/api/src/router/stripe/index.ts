import { Events } from "@openstatus/analytics";
import { workspacePlans } from "@openstatus/db/src/schema";
import type { AddonQuantityKey } from "@openstatus/db/src/schema/plan/schema";
import {
  addons,
  billingIntervals,
} from "@openstatus/db/src/schema/plan/schema";
import {
  isAddonQuantityKey,
  updateAddonInLimits,
} from "@openstatus/db/src/schema/plan/utils";
import { type ServiceContext, countWorkspaceUsage } from "@openstatus/services";
import {
  getWorkspaceForMember,
  updateWorkspaceLimits,
  updateWorkspacePlan,
  updateWorkspaceStripeId,
} from "@openstatus/services/workspace";
import { TRPCError } from "@trpc/server";
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

  await updateWorkspaceStripeId({ ctx, input: { stripeId: customer.id } });

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

        // Stripe rejects mixed billing intervals on one subscription and every
        // addon price is monthly, so a yearly plan cannot hold the addon items.
        const hasAddons = current.items.data.some(
          (item) => item.id !== planItem.id,
        );

        if (opts.input.interval === "yearly" && hasAddons) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Add-ons are billed monthly. Remove them before switching to a yearly plan, or contact us.",
          });
        }

        // Classify before mutating Stripe. An item on a price neither table
        // knows throws, and throwing *after* the update would leave the
        // customer re-priced and billed while the workspace kept the old plan
        // — a split the webhook cannot repair either, since it throws on the
        // same item.
        buildFromSubscriptionOrThrow(current);

        // Only the plan item is listed, so Stripe leaves every other item
        // untouched and the addons survive the plan change. Clearing
        // `cancel_at_period_end` resumes a subscription the customer had
        // scheduled to cancel — choosing a paid plan says they mean to keep
        // paying.
        const updated = await stripe.subscriptions.update(current.id, {
          items: [{ id: planItem.id, price: priceId }],
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
      z.object({
        workspaceSlug: z.string(),
        feature: z.enum(addons),
        value: z.union([z.boolean(), z.number()]),
      }),
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

      const priceId = getPriceIdForFeature(opts.input.feature);

      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid feature",
        });
      }

      const items = await stripe.subscriptionItems.list({
        subscription: current.id,
        limit: 100,
      });

      // Stripe rejects mixed billing intervals on one subscription and every
      // addon price is monthly, so a yearly plan cannot hold one.
      const planItem = items.data.find((item) =>
        getPlanFromPriceId(item.price.id),
      );
      if (planItem?.price.recurring?.interval === "year") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Add-ons are billed monthly. Contact us to add them to a yearly plan.",
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

      const newLimits = updateAddonInLimits(
        ws.limits,
        opts.input.feature,
        newValue,
      );

      await updateWorkspaceLimits({
        ctx: resolved.ctx,
        input: {
          limits: newLimits,
          ...(endsTrial && { trialEndsAt: null }),
          reason: endsTrial ? "trial_converted" : "addon_changed",
        },
      });

      // TODO: send email to user notifying about the change if not already from stripe

      return;
    }),
});
