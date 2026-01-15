import { z } from "zod";

import { and, eq, isNotNull } from "@openstatus/db";
import {
  invitation,
  maintenance,
  pageSubscriber,
  selectWorkspaceSchema,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails";
import { TRPCError } from "@trpc/server";
import { env } from "../../env";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "../../trpc";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

export const emailRouter = createTRPCRouter({
  sendStatusReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const limits = opts.ctx.workspace.limits;

      if (limits["status-subscribers"]) {
        // Use pageComponents instead of deprecated monitorsToPages
        const _statusReportUpdate =
          await opts.ctx.db.query.statusReportUpdate.findFirst({
            where: eq(statusReportUpdate.id, opts.input.id),
            with: {
              statusReport: {
                with: {
                  monitorsToStatusReports: {
                    with: {
                      monitor: true,
                    },
                  },
                  page: {
                    with: {
                      pageSubscribers: {
                        where: isNotNull(pageSubscriber.acceptedAt),
                      },
                      pageComponents: {
                        with: {
                          monitor: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });

        if (!_statusReportUpdate) return;
        if (!_statusReportUpdate.statusReport.page) return;
        if (
          _statusReportUpdate.statusReport.page.workspaceId !==
          opts.ctx.workspace.id
        )
          return;
        if (!_statusReportUpdate.statusReport.page.pageSubscribers.length)
          return;

        await emailClient.sendStatusReportUpdate({
          to: _statusReportUpdate.statusReport.page.pageSubscribers.map(
            (subscriber) => subscriber.email,
          ),
          pageTitle: _statusReportUpdate.statusReport.page.title,
          reportTitle: _statusReportUpdate.statusReport.title,
          status: _statusReportUpdate.status,
          message: _statusReportUpdate.message,
          date: new Date(_statusReportUpdate.date).toISOString(),
          monitors:
            _statusReportUpdate.statusReport.monitorsToStatusReports.map(
              (i) => i.monitor.externalName || i.monitor.name,
            ),
        });
      }
    }),
  sendMaintenance: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const limits = opts.ctx.workspace.limits;

      if (limits["status-subscribers"]) {
        const _maintenance = await opts.ctx.db.query.maintenance.findFirst({
          where: and(
            eq(maintenance.id, opts.input.id),
            eq(maintenance.workspaceId, opts.ctx.workspace.id),
          ),
          with: {
            maintenancesToMonitors: {
              with: {
                monitor: true,
              },
            },
            page: {
              with: {
                pageSubscribers: {
                  where: isNotNull(pageSubscriber.acceptedAt),
                },
              },
            },
          },
        });

        if (!_maintenance) return;
        if (!_maintenance.page) return;
        if (!_maintenance.page.pageSubscribers.length) return;

        await emailClient.sendStatusReportUpdate({
          to: _maintenance.page.pageSubscribers.map(
            (subscriber) => subscriber.email,
          ),
          pageTitle: _maintenance.page.title,
          reportTitle: _maintenance.title,
          status: "maintenance",
          message: _maintenance.message,
          date: new Date(_maintenance.from).toISOString(),
          monitors: _maintenance.maintenancesToMonitors.map(
            (i) => i.monitor.externalName || i.monitor.name,
          ),
        });
      }
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

  sendPageSubscription: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const _pageSubscriber = await opts.ctx.db.query.pageSubscriber.findFirst({
        where: eq(pageSubscriber.id, opts.input.id),
        with: {
          page: {
            with: {
              workspace: true,
            },
          },
        },
      });

      if (!_pageSubscriber || !_pageSubscriber.token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page subscriber not found",
        });
      }

      const workspace = selectWorkspaceSchema.safeParse(
        _pageSubscriber.page.workspace,
      );

      if (!workspace.success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }
      if (!workspace.data.limits["status-subscribers"]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Upgrade to use status subscribers",
        });
      }

      const link = _pageSubscriber.page.customDomain
        ? `https://${_pageSubscriber.page.customDomain}/verify/${_pageSubscriber.token}`
        : `https://${_pageSubscriber.page.slug}.openstatus.dev/verify/${_pageSubscriber.token}`;

      await emailClient.sendPageSubscription({
        to: _pageSubscriber.email,
        page: _pageSubscriber.page.title,
        link,
      });
    }),
});
