import { z } from "zod";

import { and, eq } from "@openstatus/db";
import {
  invitation,
  maintenance,
  pageSubscription,
  selectWorkspaceSchema,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails";
import {
  dispatchMaintenanceUpdate,
  dispatchStatusReportUpdate,
  getChannel,
} from "@openstatus/subscriptions";
import { TRPCError } from "@trpc/server";
import { env } from "../../env";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "../../trpc";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

export const emailRouter = createTRPCRouter({
  /**
   * PUBLIC: Send verification email for a page subscription
   * Runs on Lambda because it uses EmailClient (not Edge-compatible)
   */
  sendPageSubscriptionVerification: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      }),
    )
    .mutation(async (opts) => {
      const subscription = await opts.ctx.db.query.pageSubscription.findFirst({
        where: eq(pageSubscription.id, opts.input.id),
        with: {
          page: true,
          workspace: true,
        },
      });

      const workspace = selectWorkspaceSchema.safeParse(
        subscription?.workspace,
      );

      if (!workspace.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid workspace",
        });
      }

      const limits = workspace.data.limits;

      if (!limits["status-subscribers"]) {
        return;
      }

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      if (!subscription.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No email associated with this subscription",
        });
      }

      if (subscription.verifiedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Subscription already verified",
        });
      }

      // Build verification URL
      const verifyUrl = subscription.page.customDomain
        ? `https://${subscription.page.customDomain}/verify/${subscription.token}`
        : `https://${subscription.page.slug}.openstatus.dev/verify/${subscription.token}`;

      // Get email channel and send verification
      const channel = getChannel("email");

      if (!channel) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Email channel not found",
        });
      }

      await channel.sendVerification?.(
        {
          id: subscription.id,
          pageId: subscription.pageId,
          pageName: subscription.page.title,
          pageSlug: subscription.page.slug,
          customDomain: subscription.page.customDomain,
          workspaceId: subscription.workspaceId,
          componentIds: [], // Not needed for verification email
          channelType: "email",
          email: subscription.email,
          token: subscription.token,
          verifiedAt: subscription.verifiedAt ?? undefined,
        },
        verifyUrl,
      );

      return { success: true };
    }),

  /**
   * PROTECTED: Manually send status report update notifications
   * Runs on Lambda, uses new subscription dispatcher
   */
  sendStatusReportUpdate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const limits = opts.ctx.workspace.limits;

      if (!limits["status-subscribers"]) {
        return;
      }

      // Verify the status report update exists and belongs to workspace
      const update = await opts.ctx.db.query.statusReportUpdate.findFirst({
        where: eq(statusReportUpdate.id, opts.input.id),
        with: {
          statusReport: true,
        },
      });

      if (!update?.statusReport) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Status report update not found",
        });
      }

      if (update.statusReport.workspaceId !== opts.ctx.workspace.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Status report does not belong to your workspace",
        });
      }

      // Dispatch notifications via new subscription system
      await dispatchStatusReportUpdate(opts.input.id);

      return { success: true };
    }),

  /**
   * PROTECTED: Manually send maintenance notifications
   * Runs on Lambda, uses new subscription dispatcher
   */
  sendMaintenance: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const limits = opts.ctx.workspace.limits;

      if (!limits["status-subscribers"]) {
        return;
      }

      // Verify the maintenance exists and belongs to workspace
      const _maintenance = await opts.ctx.db.query.maintenance.findFirst({
        where: and(
          eq(maintenance.id, opts.input.id),
          eq(maintenance.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!_maintenance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Maintenance not found",
        });
      }

      // Dispatch notifications via new subscription system
      await dispatchMaintenanceUpdate(opts.input.id);

      return { success: true };
    }),

  sendTeamInvitation: protectedProcedure
    .input(z.object({ id: z.number(), baseUrl: z.string().optional() }))
    .mutation(async (opts) => {
      const limits = opts.ctx.workspace.limits;

      if (limits.members === "Unlimited" || limits.members > 1) {
        const _invitation = await opts.ctx.db.query.invitation.findFirst({
          where: and(
            eq(invitation.id, opts.input.id),
            eq(invitation.workspaceId, opts.ctx.workspace.id),
          ),
        });

        if (!_invitation) return;

        await emailClient.sendTeamInvitation({
          to: _invitation.email,
          token: _invitation.token,
          invitedBy: `${opts.ctx.user.email}`,
          workspaceName: opts.ctx.workspace.name || "OpenStatus",
          baseUrl: opts.input.baseUrl,
        });
      }
    }),
});
