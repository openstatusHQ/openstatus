import { generateSlug } from "random-word-slugs";
import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const workspaceRouter = createTRPCRouter({
  getUserWithWorkspace: protectedProcedure.query(async (opts) => {
    return await opts.ctx.db.query.user.findMany({
      with: {
        usersToWorkspaces: {
          with: {
            workspace: true,
          },
        },
      },
      where: eq(user.tenantId, opts.ctx.auth.userId),
    });
  }),

  getWorkspace: protectedProcedure.query(async (opts) => {
    const result = await opts.ctx.db.query.workspace.findFirst({
      where: eq(workspace.id, opts.ctx.workspace.id),
    });

    return selectWorkspaceSchema.parse(result);
  }),

  getWorkspaceUsers: protectedProcedure.query(async (opts) => {
    // const result = await opts.ctx.db
    //   .select()
    //   .from(usersToWorkspaces)
    //   .leftJoin(user, eq(user.id, usersToWorkspaces.userId))
    //   .where(eq(usersToWorkspaces.workspaceId, opts.ctx.workspace.id))
    //   .all();
    // return result.map(({ user }) => user);

    const result = await opts.ctx.db.query.usersToWorkspaces.findMany({
      with: {
        user: true,
      },
      where: eq(usersToWorkspaces.workspaceId, opts.ctx.workspace.id),
    });
    return result.map(({ user }) => user);
  }),

  createWorkspace: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async (opts) => {
      const slug = generateSlug(2);

      return opts.ctx.db
        .insert(workspace)
        .values({ slug: slug, name: opts.input.name })
        .returning()
        .get();
    }),
});
