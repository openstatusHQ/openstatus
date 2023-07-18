import { z } from "zod";

import { eq } from "@openstatus/db";
import { insertPageSchema, page } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

// TODO: deletePageById - updatePageById
export const pageRouter = createTRPCRouter({
  createPage: protectedProcedure
    .input(insertPageSchema)
    .mutation(async (opts) => {
      await opts.ctx.db.insert(page).values(opts.input).execute();
    }),

  getPageById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      return await opts.ctx.db.query.page
        .findFirst({
          where: eq(page.id, opts.input.id),
          with: { monitors: true, incidents: true },
        })
        .execute();
    }),
  getPageByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(async (opts) => {
      return await opts.ctx.db
        .select()
        .from(page)
        .where(eq(page.workspaceId, opts.input.workspaceId));
    }),
  // public if we use trpc hooks to get the page from the url
  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async (opts) => {
      return await opts.ctx.db.query.page
        .findFirst({
          where: eq(page.slug, opts.input.slug),
          with: { monitors: true, incidents: true },
        })
        .execute();
    }),
});
