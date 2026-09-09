import { Events } from "@openstatus/analytics";
import { eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  user,
  usersToWorkspaces,
  workspace,
  workspacePlans,
} from "@openstatus/db/src/schema";
import type { AddonQuantityKey } from "@openstatus/db/src/schema/plan/schema";
import {
  addons,
  billingIntervals,
} from "@openstatus/db/src/schema/plan/schema";
import {
  isAddonQuantityKey,
  updateAddonInLimits,
} from "@openstatus/db/src/schema/plan/utils";
import { countWorkspaceUsage } from "@openstatus/services";
import { updateWorkspacePlan } from "@openstatus/services/workspace";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  buildFromSubscriptionOrThrow,
  getCurrentSubscription,
  stripe,
} from "./shared";
import {
  getPlanFromPriceId,
  getPriceIdForFeature,
  getPriceIdForPlan,
  resolveAddonQuantity,
} from "./utils";
import { webhookRouter } from "./webhook";

// The addon `title` reads wrong in the "you already have N ..." sentence.
const LIMIT_LABEL: Record<AddonQuantityKey, string> = {
  monitors: "monitors",
  "status-pages": "status pages",
};

const url =
  process.env.NODE_ENV === "production"
    ? "https://www.openstatus.dev"
    : "http://localhost:3000";

export const stripeRouter = createTRPCRouter({
  webhooks: webhookRouter,

  getUserCustomerPortal: protectedProcedure
    .input(
      z.object({ workspaceSlug: z.string(), returnUrl: z.string().optional() }),
    )
    .mutation(async (opts) => {
      const result = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();

      if (!result) return;

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.id, opts.ctx.user.id))
        .as("currentUser");
      const userHasAccess = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, result.id))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!userHasAccess || !userHasAccess.users_to_workspaces) return;
      let stripeId = result.stripeId;
      if (!stripeId) {
        const customerData: {
          metadata: { workspaceId: string };
          email?: string;
        } = {
          metadata: {
            workspaceId: String(result.id),
          },
          email: userHasAccess.currentUser.email || "",
        };

        const stripeUser = await stripe.customers.create(customerData);

        stripeId = stripeUser.id;
        await opts.ctx.db
          .update(workspace)
          .set({ stripeId })
          .where(eq(workspace.id, result.id))
          .run();
      }

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
      // The following code is duplicated we should extract it
      const result = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();

      if (!result) return;

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.id, opts.ctx.user.id))
        .as("currentUser");
      const userHasAccess = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, result.id))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!userHasAccess || !userHasAccess.users_to_workspaces) return;
      let stripeId = result.stripeId;
      if (!stripeId) {
        const currentUser = await opts.ctx.db
          .select()
          .from(user)
          .where(eq(user.id, opts.ctx.user.id))
          .get();
        const customerData: {
          metadata: { workspaceId: string };
          email?: string;
        } = {
          metadata: {
            workspaceId: String(result.id),
          },
          email: currentUser?.email || "",
        };
        const stripeUser = await stripe.customers.create(customerData);

        stripeId = stripeUser.id;
        await opts.ctx.db
          .update(workspace)
          .set({ stripeId })
          .where(eq(workspace.id, result.id))
          .run();
      }

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

      if (current) {
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
          ctx: {
            workspace: selectWorkspaceSchema.parse(result),
            actor: { type: "user", userId: opts.ctx.user.id },
            db: opts.ctx.db,
          },
          input: {
            plan: built.plan,
            subscriptionId: updated.id,
            endsAt: new Date(updated.current_period_end * 1000),
            paidUntil: new Date(updated.current_period_end * 1000),
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
        success_url:
          opts.input.successUrl ||
          `${url}/app/${result.slug}/settings/billing?success=true`,
        cancel_url:
          opts.input.cancelUrl || `${url}/app/${result.slug}/settings/billing`,
      });

      return { type: "checkout" as const, session };
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
      // The following code is duplicated we should extract it
      const result = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();

      if (!result) return;

      const ws = selectWorkspaceSchema.parse(result);

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.id, opts.ctx.user.id))
        .as("currentUser");
      const userHasAccess = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, result.id))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!userHasAccess || !userHasAccess.users_to_workspaces) return;
      const stripeId = result.stripeId;
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
          result.id,
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
      const isRemoval = opts.input.value === false || quantity === 0;

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

      await opts.ctx.db
        .update(workspace)
        .set({ limits: JSON.stringify(newLimits) })
        .where(eq(workspace.id, result.id))
        .run();

      // TODO: send email to user notifying about the change if not already from stripe

      return;
    }),
});
