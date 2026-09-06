import { apiKeySettableScopes } from "@openstatus/db/src/schema/api-keys/constants";
import {
  GetSessionInput,
  RevokeGrantInput,
  decideSession,
  getSession,
  isUrlClientId,
  listGrants,
  revokeGrant,
} from "@openstatus/services/oauth";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure, userProcedure } from "../trpc";

// URL client ids prove domain ownership; surface that host so a user can spot
// a lookalike name. DCR clients are self-described and carry no origin.
function clientOrigin(clientId: string): string | null {
  return isUrlClientId(clientId) ? new URL(clientId).hostname : null;
}

const DecideInput = z.object({
  id: z.string().min(1),
  approved: z.boolean(),
  workspaceId: z.number().int().optional(),
  scope: z.enum(apiKeySettableScopes).optional(),
});

/**
 * Consent runs on `userProcedure`: a user removed from every workspace must
 * still see the page (with a create-workspace prompt) instead of a 401.
 */
export const oauthRouter = createTRPCRouter({
  getSession: userProcedure
    .input(GetSessionInput)
    .query(async ({ ctx, input }) => {
      try {
        const session = await getSession({ input });
        return {
          session: { ...session, clientOrigin: clientOrigin(session.clientId) },
          workspaces: (ctx.workspaces ?? []).map((w) => ({
            id: w.id,
            name: w.name,
            slug: w.slug,
          })),
        };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  decide: userProcedure.input(DecideInput).mutation(async ({ ctx, input }) => {
    try {
      return await decideSession({
        input: {
          id: input.id,
          approved: input.approved,
          userId: ctx.user.id,
          workspaceId: input.workspaceId,
          scope: input.scope ? [input.scope] : undefined,
        },
      });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  listGrants: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listGrants({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  revokeGrant: protectedProcedure
    .input(RevokeGrantInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await revokeGrant({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
