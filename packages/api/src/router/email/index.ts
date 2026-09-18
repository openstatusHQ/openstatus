import { and, eq } from "@openstatus/db";
import { invitation } from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails";
import { z } from "zod";

import { env } from "../../env";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

export const emailRouter = createTRPCRouter({
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
