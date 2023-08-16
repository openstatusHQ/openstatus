import { generateSlug } from "random-word-slugs";
import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  user,
  workspace,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { hasUserAccessToWorkspace } from "./utils";

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

  getWorkspace: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async (opts) => {
      const data = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.slug,
        ctx: opts.ctx,
      });
      if (!data) return;

      const result = await opts.ctx.db.query.workspace.findFirst({
        where: eq(workspace.id, data.workspace.id),
      });

      return selectWorkspaceSchema.parse(result);
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
