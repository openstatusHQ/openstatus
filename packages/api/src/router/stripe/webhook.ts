import { Events, setupAnalytics } from "@openstatus/analytics";
import { eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import {
  downgradeWorkspaceToFree,
  getWorkspaceByStripeId,
  updateWorkspacePlan,
} from "@openstatus/services/workspace";
import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";
import { z } from "zod";

import { removeDomainFromVercelIfUnused } from "../../lib/vercel";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import { stripe } from "./shared";
import { buildLimitsFromSubscription } from "./utils";

// An unsupported price is a permanent misconfiguration; surface it as a 400 so
// Stripe stops retrying instead of hammering the endpoint on a 5xx.
function buildFromSubscriptionOrThrow(subscription: Stripe.Subscription) {
  try {
    return buildLimitsFromSubscription(subscription);
  } catch (e) {
    console.error(e);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: e instanceof Error ? e.message : "Invalid subscription",
    });
  }
}

const webhookProcedure = publicProcedure.input(
  z.object({
    // From type Stripe.Event
    event: z.object({
      id: z.string(),
      account: z.string().nullish(),
      created: z.number(),
      data: z.object({
        object: z.record(z.string(), z.any()),
      }),
      type: z.string(),
    }),
  }),
);

export const webhookRouter = createTRPCRouter({
  customerSubscriptionUpdated: webhookProcedure.mutation(async (opts) => {
    const subscription = opts.input.event.data.object as Stripe.Subscription;

    if (subscription.status !== "active") {
      return;
    }

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const ws = await getWorkspaceByStripeId({
      input: { stripeId: customerId },
      db: opts.ctx.db,
    });
    if (!ws) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Workspace not found",
      });
    }

    const oldPlan = ws.plan;

    const built = buildFromSubscriptionOrThrow(subscription);

    // Subscription has no recognized plan item (e.g. a standalone addon sub);
    // nothing to sync here, unlike sessionCompleted which always has a plan.
    if (!built) {
      return;
    }

    // No `reason` metadata: `customer.subscription.updated` fires on trivial
    // changes too, so let the audit no-op-skip drop rows where nothing
    // tracked changed. The `stripe-subscription-updated` actor id still
    // identifies the source on the rows that do land.
    await updateWorkspacePlan({
      ctx: {
        workspace: ws,
        actor: { type: "system", job: "stripe-subscription-updated" },
        db: opts.ctx.db,
      },
      input: {
        plan: built.plan,
        subscriptionId: subscription.id,
        endsAt: new Date(subscription.current_period_end * 1000),
        paidUntil: new Date(subscription.current_period_end * 1000),
        limits: built.limits,
      },
    });

    const allActive = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
    });

    for (const sub of allActive.data) {
      if (sub.id === subscription.id) continue;
      try {
        await stripe.subscriptions.cancel(sub.id);
      } catch (e) {
        console.error(`Failed to cancel duplicate subscription ${sub.id}:`, e);
      }
    }

    const newPlan = built.plan;
    if (newPlan !== oldPlan) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && customer.email) {
        const userResult = await opts.ctx.db
          .select()
          .from(user)
          .where(eq(user.email, customer.email))
          .get();
        if (!userResult) return;

        const planOrder = ["free", "starter", "team", "scale"] as const;
        const oldIndex = planOrder.indexOf(oldPlan ?? "free");
        const newIndex = planOrder.indexOf(newPlan ?? "free");

        const event =
          newIndex > oldIndex
            ? Events.UpgradeWorkspace
            : Events.DowngradeWorkspace;

        const analytics = await setupAnalytics({
          userId: `usr_${userResult.id}`,
          email: userResult.email || undefined,
          workspaceId: String(ws.id),
          plan: newPlan,
        });
        await analytics.track(event);
      }
    }
  }),
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

    const ws = await getWorkspaceByStripeId({
      input: { stripeId: customerId },
      db: opts.ctx.db,
    });
    if (!ws) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Workspace not found",
      });
    }

    const built = buildFromSubscriptionOrThrow(subscription);
    if (!built) {
      console.error("Invalid plan");
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid plan",
      });
    }

    await updateWorkspacePlan({
      ctx: {
        workspace: ws,
        actor: { type: "system", job: "stripe-session-completed" },
        db: opts.ctx.db,
      },
      input: {
        plan: built.plan,
        subscriptionId: subscription.id,
        endsAt: new Date(subscription.current_period_end * 1000),
        paidUntil: new Date(subscription.current_period_end * 1000),
        limits: built.limits,
        reason: "checkout_session_completed",
      },
    });

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
        workspaceId: String(ws.id),
        plan: built.plan,
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

    const activeSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
    });

    if (activeSubscriptions.data.length > 0) {
      return;
    }

    const ws = await getWorkspaceByStripeId({
      input: { stripeId: customerId },
      db: opts.ctx.db,
    });

    if (!ws) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Workspace not found",
      });
    }

    // System actor — no user is attributable to an involuntary Stripe
    // cancellation. The service verb runs the whole trim in one audited
    // transaction; a failed audit insert rolls the downgrade back and the
    // webhook returns non-2xx so Stripe retries.
    const ctx: ServiceContext = {
      workspace: ws,
      actor: { type: "system", job: "stripe-subscription-deleted" },
      db: opts.ctx.db,
    };

    const { customDomains } = await downgradeWorkspaceToFree({ ctx });

    // Free plan has no custom-domain feature — release each domain on Vercel
    // unless another workspace's page still holds it. Best-effort after
    // commit: a Vercel error must not fail the webhook into Stripe retries.
    for (const domain of customDomains) {
      try {
        await removeDomainFromVercelIfUnused(opts.ctx.db, domain);
      } catch (err) {
        console.error("Failed to release domain from Vercel:", {
          domain,
          error: err,
        });
      }
    }

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
        email: customer.email || undefined,
        workspaceId: String(ws.id),
        plan: "free",
      });
      await analytics.track(Events.DowngradeWorkspace);
    }
  }),
});
