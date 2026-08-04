import { Events } from "@openstatus/analytics";
import {
  getWorkspaceWithUsage,
  updateWorkspaceName,
} from "@openstatus/services/workspace";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const workspaceRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getWorkspaceWithUsage({ ctx: toServiceCtx(ctx) });
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
