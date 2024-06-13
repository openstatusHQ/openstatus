import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  user,
  usersToWorkspaces,
  workspace,
  workspacePlans,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { stripe } from "./shared";
import { PLANS, getPriceIdForPlan } from "./utils";
import { webhookRouter } from "./webhook";

const url =
  process.env.NODE_ENV === "production"
    ? "https://www.openstatus.dev"
    : "http://localhost:3000";

export const stripeRouter = createTRPCRouter({
  webhooks: webhookRouter,

  getUserCustomerPortal: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
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
        return_url: `${url}/app/${result.slug}/settings`,
      });

      return session.url;
    }),

  getCheckoutSession: protectedProcedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        plan: z.enum(workspacePlans),
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

        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${url}/app/${result.slug}/settings/billing?success=true`,
        cancel_url: `${url}/app/${result.slug}/settings/billing`,
      });

      return session;
    }),
});
