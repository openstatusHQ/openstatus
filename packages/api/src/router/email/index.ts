import { z } from "zod";

import { and, eq } from "@openstatus/db";
import {
  invitation,
  maintenance,
  pageSubscriber,
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
   * PUBLIC: Send verification email for a new page subscription
   * Called after upsert to trigger the verification flow
   */
  sendPageSubscriptionVerification: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        token: z.uuid(),
      }),
    )
    .mutation(async (opts) => {
      const subscriber = await opts.ctx.db.query.pageSubscriber.findFirst({
        where: and(
          eq(pageSubscriber.id, opts.input.id),
          eq(pageSubscriber.token, opts.input.token),
        ),
        with: {
          page: {
            with: {
              workspace: true,
            },
          },
        },
      });

      if (!subscriber) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscriber not found",
        });
      }

      const workspace = selectWorkspaceSchema.safeParse(
        subscriber.page?.workspace,
      );

      if (!workspace.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid workspace",
        });
      }

      if (!workspace.data.limits["status-subscribers"]) {
        return;
      }

      if (!subscriber.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No email associated with this subscription",
        });
      }

      if (subscriber.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Subscription already verified",
        });
      }

      if (!subscriber.token) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Subscription has no verification token",
        });
      }

      const verifyUrl = subscriber.page.customDomain
        ? `https://${subscriber.page.customDomain}/verify/${subscriber.token}`
        : `https://${subscriber.page.slug}.openstatus.dev/verify/${subscriber.token}`;

      const channel = getChannel("email");
      if (!channel) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Email channel not found",
        });
      }

      await channel.sendVerification?.(
        {
          id: subscriber.id,
          pageId: subscriber.pageId,
          pageName: subscriber.page.title,
          pageSlug: subscriber.page.slug,
          customDomain: subscriber.page.customDomain,
          componentIds: [],
          channelType: "email",
          email: subscriber.email,
          token: subscriber.token,
          acceptedAt: subscriber.acceptedAt ?? undefined,
        },
        verifyUrl,
      );

      return { success: true };
    }),

  /**
   * PROTECTED: Send status report update notifications via dispatcher
   */
  sendStatusReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const limits = opts.ctx.workspace.limits;

      if (!limits["status-subscribers"]) {
        return;
      }

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

      await dispatchStatusReportUpdate(opts.input.id);

      return { success: true };
    }),

  /**
   * PROTECTED: Send maintenance notifications via dispatcher
   */
  sendMaintenance: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const limits = opts.ctx.workspace.limits;

      if (!limits["status-subscribers"]) {
        return;
      }

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
