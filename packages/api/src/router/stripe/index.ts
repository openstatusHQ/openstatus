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
import { TRPCError } from "@trpc/server";
import type { Stripe } from "stripe";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { stripe } from "./shared";
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

      return session;
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

      const sub = (await stripe.customers.retrieve(stripeId, {
        expand: ["subscriptions"],
      })) as Stripe.Customer;

      if (!sub) {
        return;
      }

      if (!sub.subscriptions?.data[0]?.id) {
        return;
      }

      const priceId = getPriceIdForFeature(opts.input.feature);

      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid feature",
        });
      }

      const subscriptionId = sub.subscriptions.data[0].id;

      const items = await stripe.subscriptionItems.list({
        subscription: subscriptionId,
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
          subscription: subscriptionId,
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
