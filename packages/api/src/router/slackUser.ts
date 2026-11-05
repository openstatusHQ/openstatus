import {
  createSlackUserMapping,
  getSlackUserMapping,
  listSlackUserMappings,
  verifySlackLinkToken,
} from "@openstatus/services/slack-user";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

async function readLinkToken(token: string) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Slack not configured",
    });
  }
  return verifySlackLinkToken(secret, token);
}

export const slackUserRouter = createTRPCRouter({
  previewLink: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const payload = await readLinkToken(input.token);
      if (!payload) return { status: "invalid" as const };
      if (payload.workspaceId === ctx.workspace.id) {
        return { status: "ready" as const, workspaceName: ctx.workspace.name };
      }
      const target = ctx.workspaces.find((w) => w.id === payload.workspaceId);
      if (target) {
        return {
          status: "wrong-workspace" as const,
          workspaceName: target.name,
          workspaceSlug: target.slug,
        };
      }
      return { status: "not-member" as const };
    }),

  link: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payload = await readLinkToken(input.token);
      if (!payload) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This link is invalid or has expired.",
        });
      }
      if (payload.workspaceId !== ctx.workspace.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This link belongs to another workspace.",
        });
      }
      try {
        const serviceCtx = toServiceCtx(ctx);
        // The token only proves someone saw the card, so it must not move a
        // Slack account that already belongs to another member.
        const linkedTo = await getSlackUserMapping({
          ctx: serviceCtx,
          input: { teamId: payload.teamId, slackUserId: payload.slackUserId },
        });
        if (linkedTo !== null && linkedTo !== ctx.user.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This Slack account is already linked to another member of this workspace.",
          });
        }
        return await createSlackUserMapping({
          ctx: serviceCtx,
          input: {
            teamId: payload.teamId,
            slackUserId: payload.slackUserId,
            userId: ctx.user.id,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listSlackUserMappings({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),
});
