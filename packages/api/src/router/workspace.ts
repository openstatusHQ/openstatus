import { generateSlug } from "random-word-slugs";
import { z } from "zod";

import { and, eq } from "@openstatus/db";
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

  getUserWorkspaces: protectedProcedure.query(async (opts) => {
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

  getWorkspaceUsers: protectedProcedure.query(async (opts) => {
    const result = await opts.ctx.db.query.usersToWorkspaces.findMany({
      with: {
        user: true,
      },
      where: eq(usersToWorkspaces.workspaceId, opts.ctx.workspace.id),
    });
    return result;
  }),

  updateWorkspace: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async (opts) => {
      return await opts.ctx.db
        .update(workspace)
        .set({ name: opts.input.name })
        .where(eq(workspace.id, opts.ctx.workspace.id));
    }),

  removeWorkspaceUser: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const _userToWorkspace =
        await opts.ctx.db.query.usersToWorkspaces.findFirst({
          where: and(
            eq(usersToWorkspaces.userId, opts.ctx.user.id),
            eq(usersToWorkspaces.workspaceId, opts.ctx.workspace.id),
          ),
        });

      if (!_userToWorkspace) throw new Error("No user to workspace found");

      if (!["owner"].includes(_userToWorkspace.role))
        throw new Error("Not authorized to remove user from workspace");

      if (opts.input.id === opts.ctx.user.id)
        throw new Error("Cannot remove yourself from workspace");

      await opts.ctx.db
        .delete(usersToWorkspaces)
        .where(
          and(
            eq(usersToWorkspaces.userId, opts.input.id),
            eq(usersToWorkspaces.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .run();
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
