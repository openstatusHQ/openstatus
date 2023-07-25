import { customAlphabet, urlAlphabet } from "nanoid";
import { z } from "zod";

import { and, eq, inArray } from "@openstatus/db";
import {
  insertPageSchemaWithMonitors,
  monitor,
  monitorsToPages,
  page,
  selectIncidentSchema,
  selectMonitorSchema,
  selectPageSchema,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

// TODO: deletePageById - updatePageById
export const pageRouter = createTRPCRouter({
  createPage: protectedProcedure
    .input(insertPageSchemaWithMonitors)
    .mutation(async (opts) => {
      const { monitors, id, ...pageInput } = opts.input;

      const nanoid = customAlphabet(urlAlphabet, 10);

      const newPage = await opts.ctx.db
        .insert(page)
        .values({ id: nanoid(), ...pageInput })
        .returning()
        .get();
      if (monitors && monitors.length > 0) {
        // We should make sure the user has access to the monitors
        const values = monitors.map((monitorId) => ({
          monitorId: monitorId,
          pageId: newPage.id,
        }));

        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }
    }),

  getPageById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async (opts) => {
      const currentUser = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .get();

      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, currentUser.id))
        .all();
      const workspaceIds = result.map((workspace) => workspace.workspaceId);

      return await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.id),
          inArray(page.workspaceId, workspaceIds),
        ),
        with: { monitorsToPages: { with: { monitor: true } }, incidents: true },
      });
    }),
  updatePage: protectedProcedure
    .input(insertPageSchemaWithMonitors)
    .mutation(async (opts) => {
      const { monitors, ...pageInput } = opts.input;

      const currentPage = await opts.ctx.db
        .update(page)
        .set(pageInput)
        .where(eq(page.id, opts.input.id))
        .returning()
        .get();

      // TODO: optimize!
      const currentMonitorsToPages = await opts.ctx.db
        .select()
        .from(monitorsToPages)
        .where(eq(monitorsToPages.pageId, currentPage.id))
        .all();

      const currentMonitorsToPagesIds = currentMonitorsToPages.map(
        ({ monitorId }) => monitorId,
      );

      const removedMonitors = currentMonitorsToPagesIds.filter(
        (x) => !monitors?.includes(x),
      );

      const addedMonitors = monitors?.filter(
        (x) => !currentMonitorsToPagesIds?.includes(x),
      );

      if (addedMonitors && addedMonitors.length > 0) {
        const values = addedMonitors.map((monitorId) => ({
          monitorId: monitorId,
          pageId: opts.input.id,
        }));

        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }

      if (removedMonitors && removedMonitors.length > 0) {
        await opts.ctx.db
          .delete(monitorsToPages)
          .where(
            and(
              eq(monitorsToPages.pageId, opts.input.id),
              inArray(monitorsToPages.monitorId, removedMonitors),
            ),
          )
          .run();
      }
    }),
  deletePage: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async (opts) => {
      // TODO: this looks not very affective
      const currentUser = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .get();

      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, currentUser.id))
        .all();
      const workspaceIds = result.map((workspace) => workspace.workspaceId);
      // two queries - can we reduce it?

      const pageToDelete = await opts.ctx.db
        .select()
        .from(page)
        .where(
          and(
            eq(page.id, opts.input.pageId),
            inArray(page.workspaceId, workspaceIds),
          ),
        )
        .get();
      if (!pageToDelete) return;

      await opts.ctx.db
        .delete(page)
        .where(eq(page.id, opts.input.pageId))
        .run();
    }),
  getPagesByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async (opts) => {
      const currentUser = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .get();

      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, currentUser.id))
        .all();
      const workspaceIds = result.map((workspace) => workspace.workspaceId);

      return opts.ctx.db.query.page.findMany({
        where: and(
          eq(page.workspaceId, opts.input.workspaceId),
          inArray(page.workspaceId, workspaceIds),
        ),
        with: {
          monitorsToPages: { with: { monitor: true } },
        },
      });
    }),

  // public if we use trpc hooks to get the page from the url
  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async (opts) => {
      const result = await opts.ctx.db.query.page.findFirst({
        where: eq(page.slug, opts.input.slug),
        with: { incidents: true },
      });

      if (!result) {
        return;
      }

      // FIXME: There is probably a better way to do this
      const monitorsToPagesResult = await opts.ctx.db
        .select()
        .from(monitorsToPages)
        .where(eq(monitorsToPages.pageId, result.id))
        .all();

      const monitorsId = monitorsToPagesResult.map(
        (monitor) => monitor.monitorId,
      );

      const selectPageSchemaWithRelation = selectPageSchema.extend({
        monitors: z.array(selectMonitorSchema),
        incidents: z.array(selectIncidentSchema),
      });

      if (monitorsId.length === 0) {
        return selectPageSchemaWithRelation.parse({ ...result, monitors: [] });
      } // no monitors for that page

      const monitors = await opts.ctx.db
        .select()
        .from(monitor)
        .where(inArray(monitor.id, monitorsId))
        .all();

      return selectPageSchemaWithRelation.parse({ ...result, monitors });
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
