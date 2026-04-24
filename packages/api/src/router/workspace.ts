import { z } from "zod";

import { Events } from "@openstatus/analytics";
import {
  getWorkspace,
  getWorkspaceWithUsage,
  listWorkspaces,
  updateWorkspaceName,
} from "@openstatus/services/workspace";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const workspaceRouter = createTRPCRouter({
  getWorkspace: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getWorkspace({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getWorkspaceWithUsage({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listWorkspaces({
        ctx: toServiceCtx(ctx),
        input: { userId: ctx.user.id },
      });
    } catch (err) {
      toTRPCError(err);
    }
  }),

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
