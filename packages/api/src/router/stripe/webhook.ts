import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";
import { z } from "zod";

import { Events, setupAnalytics } from "@openstatus/analytics";
import { and, asc, eq, isNull, ne } from "@openstatus/db";
import {
  invitation,
  monitor,
  notification,
  page,
  selectWorkspaceSchema,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import {
  getLimits,
  updateAddonInLimits,
} from "@openstatus/db/src/schema/plan/utils";
import { createTRPCRouter, publicProcedure } from "../../trpc";
import { stripe } from "./shared";
import { getFeatureFromPriceId, getPlanFromPriceId } from "./utils";

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

    const ws = selectWorkspaceSchema.parse(result);
    const oldPlan = ws.plan;

    let detectedPlan: ReturnType<typeof getPlanFromPriceId> = undefined;

    for (const item of subscription.items.data) {
      const plan = getPlanFromPriceId(item.price.id);
      if (plan) {
        detectedPlan = plan;
        break;
      }
    }

    const finalLimits = detectedPlan ? getLimits(detectedPlan.plan) : ws.limits;

    await opts.ctx.db
      .update(workspace)
      .set({
        ...(detectedPlan ? { plan: detectedPlan.plan } : {}),
        subscriptionId: subscription.id,
        endsAt: new Date(subscription.current_period_end * 1000),
        paidUntil: new Date(subscription.current_period_end * 1000),
        limits: JSON.stringify(finalLimits),
      })
      .where(eq(workspace.id, result.id))
      .run();

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

    const newPlan = detectedPlan?.plan ?? oldPlan;
    if (detectedPlan && newPlan !== oldPlan) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && customer.email) {
        const userResult = await opts.ctx.db
          .select()
          .from(user)
          .where(eq(user.email, customer.email))
          .get();
        if (!userResult) return;

        const planOrder = ["free", "starter", "team"] as const;
        const oldIndex = planOrder.indexOf(oldPlan ?? "free");
        const newIndex = planOrder.indexOf(newPlan ?? "free");

        const event =
          newIndex > oldIndex
            ? Events.UpgradeWorkspace
            : Events.DowngradeWorkspace;

        const analytics = await setupAnalytics({
          userId: `usr_${userResult.id}`,
          email: userResult.email || undefined,
          workspaceId: String(result.id),
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

    for (const item of subscription.items.data) {
      const plan = getPlanFromPriceId(item.price.id);
      if (!plan) {
        const feature = getFeatureFromPriceId(item.price.id);
        if (feature) {
          const _ws = await opts.ctx.db
            .select()
            .from(workspace)
            .where(eq(workspace.stripeId, customerId))
            .get();

          const ws = selectWorkspaceSchema.parse(_ws);

          const currentValue = ws.limits[feature.feature];
          const newValue =
            typeof currentValue === "boolean"
              ? true
              : typeof currentValue === "number"
                ? currentValue + 1
                : currentValue;

          const newLimits = updateAddonInLimits(
            ws.limits,
            feature.feature,
            newValue,
          );

          await opts.ctx.db
            .update(workspace)
            .set({
              limits: JSON.stringify(newLimits),
            })
            .where(eq(workspace.id, result.id))
            .run();
          continue;
        }
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

    const _workspace = await opts.ctx.db.transaction(async (tx) => {
      const _workspace = await tx
        .update(workspace)
        .set({
          subscriptionId: null,
          plan: "free",
          paidUntil: null,
          endsAt: null,
          limits: JSON.stringify(getLimits("free")),
        })
        .where(eq(workspace.stripeId, customerId))
        .returning();

      if (!_workspace.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workspace not found",
        });
      }

      const workspaceId = _workspace[0].id;

      const activeMonitors = await tx
        .select({ id: monitor.id })
        .from(monitor)
        .where(
          and(
            eq(monitor.workspaceId, workspaceId),
            eq(monitor.active, true),
            isNull(monitor.deletedAt),
          ),
        )
        .orderBy(asc(monitor.createdAt));

      for (const m of activeMonitors.slice(1)) {
        await tx
          .update(monitor)
          .set({ active: false })
          .where(eq(monitor.id, m.id))
          .run();
      }

      const statusPages = await tx
        .select({ id: page.id })
        .from(page)
        .where(eq(page.workspaceId, workspaceId))
        .orderBy(asc(page.createdAt));

      for (const p of statusPages.slice(1)) {
        await tx.delete(page).where(eq(page.id, p.id)).run();
      }

      if (statusPages.length > 0) {
        await tx
          .update(page)
          .set({
            customDomain: "",
            password: null,
            accessType: "public",
            authEmailDomains: null,
          })
          .where(eq(page.id, statusPages[0].id))
          .run();
      }

      const notifications = await tx
        .select({ id: notification.id, provider: notification.provider })
        .from(notification)
        .where(eq(notification.workspaceId, workspaceId))
        .orderBy(asc(notification.createdAt));

      const keepNotification =
        notifications.find((n) => n.provider === "email") ?? notifications[0];

      for (const n of notifications.filter(
        (n) => n.id !== keepNotification?.id,
      )) {
        await tx
          .delete(notification)
          .where(eq(notification.id, n.id))
          .run();
      }

      // Remove all non-owner members from the workspace
      await tx
        .delete(usersToWorkspaces)
        .where(
          and(
            eq(usersToWorkspaces.workspaceId, workspaceId),
            ne(usersToWorkspaces.role, "owner"),
          ),
        )
        .run();

      // Remove all pending invitations for the workspace
      await tx
        .delete(invitation)
        .where(eq(invitation.workspaceId, workspaceId))
        .run();

      return _workspace;
    });

    const workspaceId = _workspace[0].id;
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
        workspaceId: String(workspaceId),
        plan: "free",
      });
      await analytics.track(Events.DowngradeWorkspace);
    }
  }),
});
