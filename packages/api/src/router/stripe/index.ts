import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  user,
  usersToWorkspaces,
  workspace,
  workspacePlans,
} from "@openstatus/db/src/schema";

import { updateAddonInLimits } from "@openstatus/db/src/schema/plan/utils";
import { TRPCError } from "@trpc/server";
import type { Stripe } from "stripe";
import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { stripe } from "./shared";
import { getPriceIdForFeature, getPriceIdForPlan } from "./utils";
import { webhookRouter } from "./webhook";
import { addons } from "@openstatus/db/src/schema/plan/schema";

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
        workspaceSlug: z.string(),
        plan: z.enum(workspacePlans),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
        // TODO: plan: workspacePlanSchema
      }),
    )
    .mutation(async (opts) => {
      console.log("getCheckoutSession");
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

      const priceId = getPriceIdForPlan(opts.input.plan);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
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
    .input(
      z.object({
        workspaceSlug: z.string(),
        feature: z.enum(addons),
        remove: z.boolean().optional(),
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

      if (opts.input.remove) {
        const items = await stripe.subscriptionItems.list({
          subscription: sub.subscriptions?.data[0]?.id,
        });
        const item = items.data.find((item) => item.price.id === priceId);
        if (item) {
          await stripe.subscriptionItems.del(item.id);
        }
      } else {
        await stripe.subscriptionItems.create({
          price: priceId,
          subscription: sub.subscriptions?.data[0]?.id,
          quantity: 1,
        });
      }

      // NOTE: update the limits based on the feature type

      const newLimits = updateAddonInLimits(
        ws.limits,
        opts.input.feature,
        opts.input.remove ? "remove" : "add",
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
