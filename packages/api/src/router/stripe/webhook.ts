import { Events, setupAnalytics } from "@openstatus/analytics";
import { and, eq } from "@openstatus/db";
import { user, usersToWorkspaces } from "@openstatus/db/src/schema";
import {
  billingRecipients,
  cancelScheduledEmail,
  schedulePlanEndingSoon,
  sendCancellationScheduled,
  sendMemberRemoved,
  sendPlanDowngraded,
  sendTrialEnding,
  stripeIdempotencyKey,
} from "@openstatus/emails";
import type { ServiceContext } from "@openstatus/services";
import {
  downgradeWorkspaceToFree,
  getWorkspaceByStripeId,
  previewWorkspaceDowngrade,
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
  isNewerSubscription,
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
        previous_attributes: z.record(z.string(), z.any()).optional(),
      }),
      type: z.string(),
    }),
  }),
);

// Stripe subscription metadata key holding the Resend id of the scheduled
// "plan ends in 3 days" reminder, so a resume can cancel it without a schema
// change.
const REMINDER_METADATA_KEY = "reminder_email_id";

type Db = Parameters<typeof getWorkspaceByStripeId>[0]["db"];

async function getOwnerEmails(db: NonNullable<Db>, workspaceId: number) {
  const owners = await db
    .select({ email: user.email })
    .from(usersToWorkspaces)
    .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, workspaceId),
        eq(usersToWorkspaces.role, "owner"),
      ),
    )
    .all();
  return owners.map((owner) => owner.email);
}

async function getBillingRecipients(
  db: NonNullable<Db>,
  workspaceId: number,
  customerId: string,
) {
  const owners = await getOwnerEmails(db, workspaceId);
  const customer = await stripe.customers.retrieve(customerId);
  return billingRecipients(owners, customer.deleted ? null : customer.email);
}

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
    const { live, current } = await getCurrentSubscription(customerId);

    // Nothing live left — `customer.subscription.deleted` owns the downgrade.
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
    await cancelSupersededSubscriptions(live, current);

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

    // Best-effort: the one place the raw event is read instead of live state.
    // The mail is keyed by event id, so a replay cannot re-send, and our own
    // metadata write below fires an update whose `previous_attributes` holds
    // only `metadata`, so it is ignored here.
    const wasCancelling =
      opts.input.event.data.previous_attributes?.cancel_at_period_end;
    const isCancelling = eventSubscription.cancel_at_period_end;
    if (
      eventSubscription.id === current.id &&
      typeof wasCancelling === "boolean" &&
      wasCancelling !== isCancelling
    ) {
      try {
        if (isCancelling) {
          const endsAt = new Date(current.current_period_end * 1000);
          const to = await getBillingRecipients(opts.ctx.db, ws.id, customerId);
          const { membersRemoved, ssoEnabled, ...preview } =
            await previewWorkspaceDowngrade({
              ctx: {
                workspace: ws,
                actor: { type: "system", job: "stripe-subscription-updated" },
                db: opts.ctx.db,
              },
            });
          const loss = {
            ...preview,
            membersRemoved: membersRemoved.length,
            sso: ssoEnabled,
          };
          const eventId = opts.input.event.id;
          await sendCancellationScheduled({
            to,
            eventId,
            plan: built.plan,
            endsAt,
            loss,
          });
          const reminderId = await schedulePlanEndingSoon({
            to,
            eventId,
            workspaceSlug: ws.slug,
            plan: built.plan,
            endsAt,
            loss,
          });
          if (reminderId) {
            await stripe.subscriptions.update(current.id, {
              metadata: { [REMINDER_METADATA_KEY]: reminderId },
            });
          }
        } else {
          const reminderId = current.metadata?.[REMINDER_METADATA_KEY];
          if (reminderId) {
            await cancelScheduledEmail(reminderId);
            await stripe.subscriptions.update(current.id, {
              metadata: { [REMINDER_METADATA_KEY]: "" },
            });
          }
        }
      } catch (err) {
        console.error("Failed to handle cancellation emails:", err);
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

    // A replayed or late `checkout.session.completed` can name a subscription
    // that a newer one has already superseded. Writing it would move the
    // workspace back to the older plan while the newer subscription keeps
    // billing, so leave the workspace to that subscription's own events.
    const { live, current } = await getCurrentSubscription(customerId);

    if (current && isNewerSubscription(current, subscription)) {
      return;
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
    await cancelSupersededSubscriptions(live, subscription);

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
  customerSubscriptionTrialWillEnd: webhookProcedure.mutation(async (opts) => {
    const subscription = opts.input.event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    if (!subscription.trial_end) return;

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

    try {
      await sendTrialEnding({
        to: await getBillingRecipients(opts.ctx.db, ws.id, customerId),
        eventId: opts.input.event.id,
        trialEnd: new Date(subscription.trial_end * 1000),
      });
    } catch (err) {
      console.error("Failed to send trial ending email:", err);
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

    const { customDomains, ssoDisabled, trimmed } =
      await downgradeWorkspaceToFree({ ctx });

    // Best-effort after commit: owners must know what the cascade removed, and
    // removed members that they lost access, but a mail failure must not fail
    // the webhook into Stripe retries.
    try {
      const eventId = opts.input.event.id;
      const owners = await getOwnerEmails(opts.ctx.db, ws.id);
      const customer = await stripe.customers.retrieve(customerId);
      await sendPlanDowngraded({
        to: billingRecipients(owners, customer.deleted ? null : customer.email),
        eventId,
        workspaceSlug: ws.slug,
        previousPlan: ws.plan ?? "paid",
        loss: {
          ...trimmed,
          membersRemoved: trimmed.membersRemoved.length,
          customDomains,
          sso: ssoDisabled,
        },
      });
      await sendMemberRemoved({
        to: trimmed.membersRemoved,
        idempotencyKey: stripeIdempotencyKey(eventId, "member-removed"),
        workspaceName: ws.name || ws.slug,
        reason: "downgrade",
        owners: billingRecipients(owners),
      });
    } catch (err) {
      console.error("Failed to send downgrade emails:", err);
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
