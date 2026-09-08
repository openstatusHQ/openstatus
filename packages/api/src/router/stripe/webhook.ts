import { Events, setupAnalytics } from "@openstatus/analytics";
import { and, eq } from "@openstatus/db";
import { user, usersToWorkspaces } from "@openstatus/db/src/schema";
import { SsoDisabledEmail, sendEmail } from "@openstatus/emails";
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
import {
  buildFromSubscriptionOrThrow,
  cancelSupersededSubscriptions,
  getCurrentSubscription,
  listLiveSubscriptions,
  stripe,
} from "./shared";

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
    const eventSubscription = opts.input.event.data
      .object as Stripe.Subscription;

    const customerId =
      typeof eventSubscription.customer === "string"
        ? eventSubscription.customer
        : eventSubscription.customer.id;

    // Deliberately built from Stripe's live state rather than from
    // `event.data.object`: Stripe guarantees neither delivery order nor
    // exactly-once delivery, so a late or duplicated event would otherwise
    // replay an outdated item set — re-enabling an addon the customer just
    // removed, or dropping one they just bought. Re-reading makes every
    // delivery converge on the same result. It also keeps
    // `current_period_end` trustworthy, which the raw payload is not: it is
    // serialised with the API version pinned on the Stripe *endpoint*, and
    // newer versions moved that field onto the subscription items.
    const { active, current } = await getCurrentSubscription(customerId);

    // Nothing active left — `customer.subscription.deleted` owns the downgrade.
    if (!current) {
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

    const oldPlan = ws.plan;

    const built = buildFromSubscriptionOrThrow(current);

    // Subscription has no recognized plan item (e.g. a standalone addon sub);
    // nothing to sync here, unlike sessionCompleted which always has a plan.
    // Bail before cancelling anything: if the newest subscription is not one
    // we can classify, the plan may well be carried by an older one, and
    // retiring that would leave the workspace paying for nothing.
    if (!built) {
      return;
    }

    // The workspace follows the newest active subscription; anything older is
    // a leftover from a plan change that went through checkout. Cancelling by
    // age rather than by "whichever subscription this event named" is what
    // stops a stale event from retiring the subscription the customer is
    // actually on.
    await cancelSupersededSubscriptions(active, current);

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
        subscriptionId: current.id,
        endsAt: new Date(current.current_period_end * 1000),
        paidUntil: new Date(current.current_period_end * 1000),
        limits: built.limits,
      },
    });

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

    // Checkout always opens a new subscription, so anything else still active
    // predates it and would keep billing. Retire it here instead of waiting
    // for an unrelated `customer.subscription.updated` to come along.
    const { active } = await getCurrentSubscription(customerId);
    await cancelSupersededSubscriptions(active, subscription);

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

    // Only the customer's *last* subscription going away is a downgrade. This
    // event also fires for a subscription we retired ourselves as superseded,
    // and for one Stripe cancelled after dunning while another still stands —
    // in both cases the customer is still subscribed and the cascade below
    // would be destructive.
    const live = await listLiveSubscriptions(customerId);

    if (live.length > 0) {
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

    const { customDomains, ssoDisabled } = await downgradeWorkspaceToFree({
      ctx,
    });

    // Best-effort after commit: owners must know SSO stopped working, but a
    // mail failure must not fail the webhook into Stripe retries.
    if (ssoDisabled) {
      try {
        const owners = await opts.ctx.db
          .select({ email: user.email })
          .from(usersToWorkspaces)
          .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
          .where(
            and(
              eq(usersToWorkspaces.workspaceId, ws.id),
              eq(usersToWorkspaces.role, "owner"),
            ),
          )
          .all();

        const to = owners
          .map((owner) => owner.email)
          .filter((email): email is string => Boolean(email));

        if (to.length > 0) {
          await sendEmail({
            from: "Thibault from OpenStatus <thibault@openstatus.dev>",
            subject: "SSO has been disabled for your workspace",
            to,
            react: SsoDisabledEmail(),
          });
        }
      } catch (err) {
        console.error("Failed to notify owners about SSO being disabled:", err);
      }
    }

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
