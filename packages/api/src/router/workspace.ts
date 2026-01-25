import { z } from "zod";

import { Events } from "@openstatus/analytics";
import { type SQL, and, eq, isNull } from "@openstatus/db";
import {
  monitor,
  selectWorkspaceSchema,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const workspaceRouter = createTRPCRouter({
  getWorkspace: protectedProcedure.query(async (opts) => {
    const result = await opts.ctx.db.query.workspace.findFirst({
      where: eq(workspace.id, opts.ctx.workspace.id),
    });

    return selectWorkspaceSchema.parse(result);
  }),

  get: protectedProcedure.query(async (opts) => {
    const whereConditions: SQL[] = [eq(workspace.id, opts.ctx.workspace.id)];

    const result = await opts.ctx.db.query.workspace.findFirst({
      where: and(...whereConditions),
      with: {
        pages: true,
        monitors: {
          where: isNull(monitor.deletedAt),
        },
        notifications: true,
      },
    });

    return selectWorkspaceSchema.parse({
      ...result,
      usage: {
        monitors: result?.monitors?.length || 0,
        notifications: result?.notifications?.length || 0,
        pages: result?.pages?.length || 0,
        // checks: result?.checks?.length || 0,
        checks: 0,
      },
    });
  }),

  list: protectedProcedure.query(async (opts) => {
    const result = await opts.ctx.db.query.usersToWorkspaces.findMany({
      where: eq(usersToWorkspaces.userId, opts.ctx.user.id),
      with: {
        workspace: true,
      },
    });

    return selectWorkspaceSchema
      .array()
      .parse(result.map(({ workspace }) => workspace));
  }),

  updateName: protectedProcedure
    .meta({ track: Events.UpdateWorkspace })
    .input(z.object({ name: z.string() }))
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [eq(workspace.id, opts.ctx.workspace.id)];

      await opts.ctx.db
        .update(workspace)
        .set({ name: opts.input.name, updatedAt: new Date() })
        .where(and(...whereConditions));
    }),
});
