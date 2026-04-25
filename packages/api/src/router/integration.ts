// biome-ignore lint/style/useNodejsImportProtocol: some error with build
import crypto from "crypto";
import {
  deleteIntegration,
  listIntegrations,
} from "@openstatus/services/integration";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * Slack install-token generation stays router-local: no DB work, no
 * workspace-scoped business rule — it's just HMAC plumbing against an env
 * secret and better kept alongside the Slack OAuth surface than inflated
 * into a service verb.
 */
function signInstallToken(args: {
  workspaceId: number;
  userId: number;
  ts: number;
}): string {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) throw new Error("Slack not configured");
  const payload = JSON.stringify(args);
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export const integrationRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listIntegrations({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  generateInstallToken: protectedProcedure.mutation(async ({ ctx }) => {
    const token = signInstallToken({
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      ts: Date.now(),
    });
    return { token };
  }),

  deleteIntegration: protectedProcedure
    .input(z.object({ integrationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteIntegration({
          ctx: toServiceCtx(ctx),
          input: { id: input.integrationId },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
