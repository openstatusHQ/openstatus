import { z } from "zod";

import { eq } from "@openstatus/db";
import { page, user, workspace } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const workspaceRouter = createTRPCRouter({
  getUserWorkspace: protectedProcedure.query(async (opts) => {
    return await opts.ctx.db.query.workspace.findMany({
      with: { user: { where: eq(user.tenantId, opts.ctx.auth.userId) } },
    });
  }),
  getWorkspacePage: protectedProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(async (opts) => {
      return await opts.ctx.db.query.workspace.findMany({
        with: {
          page: true,
        },
        where: eq(workspace.id, opts.input.workspaceId),
      });
    }),

  createWorkspace: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async (opts) => {
      await opts.ctx.db
        .insert(workspace)
        .values({ name: opts.input.name })
        .execute();
    }),
});
