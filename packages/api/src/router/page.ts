import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  insertPageSchema,
  insertPageSchemaWithMonitors,
  monitor,
  monitorsToPages,
  page,
  selectIncidentSchema,
  selectMonitorSchema,
  selectPageSchema,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

// TODO: deletePageById - updatePageById
export const pageRouter = createTRPCRouter({
  createPage: protectedProcedure
    .input(insertPageSchemaWithMonitors)
    .mutation(async (opts) => {
      const { monitors, ...pageInput } = opts.input;
      const newPage = await opts.ctx.db
        .insert(page)
        .values(pageInput)
        .returning()
        .get();
      if (monitors) {
        // We should make sure the user has access to the monitors
        const values = monitors.map((monitorId) => ({
          monitorId: monitorId,
          pageId: newPage.id,
        }));

        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }
    }),

  getPageById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      return await opts.ctx.db.query.page.findFirst({
        where: eq(page.id, opts.input.id),
        with: { monitorsToPages: { with: { monitor: true } }, incidents: true },
      });
    }),
  updatePage: protectedProcedure
    .input(insertPageSchemaWithMonitors)
    .mutation(async (opts) => {
      const { monitors, ...pageInput } = opts.input;

      await opts.ctx.db
        .update(page)
        .set(pageInput)
        .where(eq(page.id, Number(opts.input.id)))
        .returning()
        .get();

      if (monitors) {
        // We should make sure the user has access to the monitors
        const values = monitors.map((monitorId) => ({
          monitorId: monitorId,
          pageId: Number(opts.input.id),
        }));

        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }
    }),
  deletePage: protectedProcedure
    .input(z.object({ pageId: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db.delete(page).where(eq(page.id, opts.input.pageId));
    }),
  getPageByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(async (opts) => {
      return opts.ctx.db
        .select()
        .from(page)
        .where(eq(page.workspaceId, opts.input.workspaceId))
        .all();
    }),

  // public if we use trpc hooks to get the page from the url
  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async (opts) => {
      const result = opts.ctx.db.query.page.findFirst({
        where: eq(page.slug, opts.input.slug),
        with: { monitorsToPages: { with: { monitor: true } }, incidents: true },
      });
      const selectPageSchemaWithRelation = selectPageSchema.extend({
        monitors: z.array(selectMonitorSchema),
        incidents: z.array(selectIncidentSchema),
      });

      return selectPageSchemaWithRelation.parse(result);
    }),

  getSlugUniqueness: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async (opts) => {
      const result = await opts.ctx.db.query.page.findMany({
        where: eq(page.slug, opts.input.slug),
      });
      return result?.length > 0 ? false : true;
    }),
});
