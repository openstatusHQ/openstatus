import { Events } from "@openstatus/analytics";
import {
  getWorkspaceUsage,
  updateWorkspaceName,
} from "@openstatus/services/workspace";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const workspaceRouter = createTRPCRouter({
  // The authed middleware already resolved and parsed this row; re-selecting
  // it would be the same query. Counts live in `usage` — the shell reads
  // `limits` on every route, the counts only on two surfaces.
  get: protectedProcedure.query(({ ctx }) => ctx.workspace),

  usage: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getWorkspaceUsage({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  // `resolveActiveWorkspace` already joined the user's workspaces to pick the
  // active one, so this is the same rows the service would re-query.
  list: protectedProcedure.query(({ ctx }) => ctx.workspaces),

  updateName: protectedProcedure
    .meta({ track: Events.UpdateWorkspace })
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await updateWorkspaceName({
          ctx: toServiceCtx(ctx),
          input: { name: input.name },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
