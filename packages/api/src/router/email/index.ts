import { EmailClient } from "@openstatus/emails";
import { NotFoundError } from "@openstatus/services";
import { getInvitation } from "@openstatus/services/invitation";
import { z } from "zod";

import { env } from "../../env";
import { toServiceCtx, toTRPCError } from "../../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

export const emailRouter = createTRPCRouter({
  sendTeamInvitation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const limits = opts.ctx.workspace.limits;

      if (limits.members === "Unlimited" || limits.members > 1) {
        const _invitation = await getInvitation({
          ctx: toServiceCtx(opts.ctx),
          input: { id: opts.input.id },
        }).catch((err) => {
          // An unknown or foreign id sends nothing, as before.
          if (err instanceof NotFoundError) return null;
          toTRPCError(err);
        });

        if (!_invitation) return;

        const baseUrl = opts.ctx.req?.nextUrl?.origin
          ? `${opts.ctx.req.nextUrl.origin}/invite`
          : undefined;

        await emailClient.sendTeamInvitation({
          to: _invitation.email,
          token: _invitation.token,
          invitedBy: `${opts.ctx.user.email}`,
          workspaceName: opts.ctx.workspace.name || "openstatus",
          baseUrl,
        });
      }
    }),
});
