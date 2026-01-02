import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";
import { z } from "zod";

import { Events, setupAnalytics } from "@openstatus/analytics";
import { eq } from "@openstatus/db";
import { user, workspace } from "@openstatus/db/src/schema";

import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import { stripe } from "./shared";
import { getPlanFromPriceId } from "./utils";

const webhookProcedure = publicProcedure.input(
  z.object({
    // From type Stripe.Event
    event: z.object({
      id: z.string(),
      account: z.string().nullish(),
      created: z.number(),
      data: z.object({
        object: z.record(z.any()),
      }),
      type: z.string(),
    }),
  }),
);

export const webhookRouter = createTRPCRouter({
  sessionCompleted: webhookProcedure.mutation(async (opts) => {
    const session = opts.input.event.data.object as Stripe.Checkout.Session;
    if (typeof session.subscription !== "string") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Missing or invalid subscription id",
      });
    }
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription,
    );
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    const result = await opts.ctx.db
      .select()
      .from(workspace)
      .where(eq(workspace.stripeId, customerId))
      .get();
    if (!result) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Workspace not found",
      });
    }
    const plan = getPlanFromPriceId(subscription.items.data[0].price.id);
    if (!plan) {
      console.error("Invalid plan");
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid plan",
      });
    }
    await opts.ctx.db
      .update(workspace)
      .set({
        plan: plan.plan,
        subscriptionId: subscription.id,
        endsAt: new Date(subscription.current_period_end * 1000),
        paidUntil: new Date(subscription.current_period_end * 1000),
        limits: JSON.stringify(getLimits(plan.plan)),
      })
      .where(eq(workspace.id, result.id))
      .run();
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.email) {
      const userResult = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.email, customer.email))
        .get();
      if (!userResult) return;

      const analytics = await setupAnalytics({
        userId: `usr_${userResult.id}`,
        email: userResult.email || undefined,
        workspaceId: String(result.id),
        plan: plan.plan,
      });
      await analytics.track(Events.UpgradeWorkspace);
    }
  }),
  customerSubscriptionDeleted: webhookProcedure.mutation(async (opts) => {
    const subscription = opts.input.event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const _workspace = await opts.ctx.db
      .update(workspace)
      .set({
        subscriptionId: null,
        plan: "free",
        paidUntil: null,
      })
      .where(eq(workspace.stripeId, customerId))
      .returning();

    const customer = await stripe.customers.retrieve(customerId);

    if (!_workspace) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Workspace not found",
      });
    }

    if (!customer.deleted && customer.email) {
      const userResult = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.email, customer.email))
        .get();
      if (!userResult) return;

      const analytics = await setupAnalytics({
        userId: `usr_${userResult.id}`,
        email: customer.email || undefined,
        workspaceId: String(_workspace[0].id),
        plan: "free",
      });
      await analytics.track(Events.DowngradeWorkspace);
    }
  }),
});
