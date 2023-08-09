import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { analytics, trackAnalytics } from "@openstatus/analytics";
import { and, eq, inArray, sql } from "@openstatus/db";
import {
  incident,
  insertPageSchemaWithMonitors,
  monitor,
  monitorsToIncidents,
  monitorsToPages,
  page,
  selectIncidentSchema,
  selectIncidentUpdateSchema,
  selectMonitorSchema,
  selectPageSchema,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const limit = allPlans.free.limits["status-pages"];

// TODO: deletePageById - updatePageById
export const pageRouter = createTRPCRouter({
  createPage: protectedProcedure
    .input(insertPageSchemaWithMonitors)
    .mutation(async (opts) => {
      if (!opts.input.workspaceSlug) return;
      const currentWorkspace = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentWorkspace.id))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result) return;
      const { monitors, workspaceId, workspaceSlug, id, ...pageInput } =
        opts.input;

      const pageNumbers = (
        await opts.ctx.db.query.page.findMany({
          where: eq(page.workspaceId, currentWorkspace.id),
        })
      ).length;

      // the user has reached the limits
      if (pageNumbers >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your status-page limits.",
        });
      }

      const newPage = await opts.ctx.db
        .insert(page)
        .values({ workspaceId: currentWorkspace.id, ...pageInput })
        .returning()
        .get();
      if (monitors && monitors.length > 0) {
        // We should make sure the user has access to the monitors
        const allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: inArray(monitor.id, monitors),
        });
        const values = allMonitors.map((monitor) => ({
          monitorId: monitor.id,
          pageId: newPage.id,
        }));
        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }

      await analytics.identify(result.users_to_workspaces.userId, {
        userId: result.users_to_workspaces.userId,
      });
      await trackAnalytics({
        event: "Page Created",
        slug: newPage.slug,
      });
    }),

  getPageByID: protectedProcedure
    .input(z.object({ id: z.number() }))
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
        with: {
          monitorsToPages: { with: { monitor: true } },
          // incidents: true
        },
      });
    }),
  updatePage: protectedProcedure
    .input(insertPageSchemaWithMonitors)
    .mutation(async (opts) => {
      const { monitors, workspaceSlug, ...pageInput } = opts.input;
      if (!pageInput.id) return;
      const currentPage = await opts.ctx.db
        .update(page)
        .set(pageInput)
        .where(eq(page.id, pageInput.id))
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
          pageId: currentPage.id,
        }));

        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }

      if (removedMonitors && removedMonitors.length > 0) {
        await opts.ctx.db
          .delete(monitorsToPages)
          .where(
            and(
              eq(monitorsToPages.pageId, currentPage.id),
              inArray(monitorsToPages.monitorId, removedMonitors),
            ),
          )
          .run();
      }
    }),
  deletePage: protectedProcedure
    .input(z.object({ id: z.number() }))
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
            eq(page.id, opts.input.id),
            inArray(page.workspaceId, workspaceIds),
          ),
        )
        .get();
      if (!pageToDelete) return;

      await opts.ctx.db.delete(page).where(eq(page.id, pageToDelete.id)).run();
    }),
  getPagesByWorkspace: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async (opts) => {
      const currentUser = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .get();

      const currentWorkspace = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(
          and(
            eq(usersToWorkspaces.userId, currentUser.id),
            eq(usersToWorkspaces.workspaceId, currentWorkspace.id),
          ),
        )
        .all();
      if (!result) return;

      return opts.ctx.db.query.page.findMany({
        where: and(eq(page.workspaceId, currentWorkspace.id)),
        with: {
          monitorsToPages: { with: { monitor: true } },
        },
      });
    }),

  // public if we use trpc hooks to get the page from the url
  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .query(async (opts) => {
      const result = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug}`,
        // with: { incidents: true },
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
        ({ monitorId }) => monitorId,
      );

      const monitorsToIncidentsResult = await opts.ctx.db
        .select()
        .from(monitorsToIncidents)
        .where(inArray(monitorsToIncidents.monitorId, monitorsId))
        .all();

      const incidentsId = monitorsToIncidentsResult.map(
        ({ incidentId }) => incidentId,
      );

      const selectPageSchemaWithRelation = selectPageSchema.extend({
        monitors: z.array(selectMonitorSchema),
        incidents: z.array(
          selectIncidentSchema.extend({
            incidentUpdates: selectIncidentUpdateSchema,
          }),
        ),
      });

      const incidents =
        incidentsId.length > 0
          ? await opts.ctx.db.query.incident.findMany({
              where: inArray(incident.id, incidentsId),
              with: { incidentUpdates: true },
            })
          : [];

      const monitors =
        monitorsId.length > 0
          ? await opts.ctx.db
              .select()
              .from(monitor)
              .where(
                and(inArray(monitor.id, monitorsId), eq(monitor.active, true)), // REMINDER: this is hardcoded
              )
              .all()
          : [];

      return selectPageSchemaWithRelation.parse({
        ...result,
        monitors,
        incidents,
      });
    }),

  getSlugUniqueness: protectedProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .query(async (opts) => {
      // had filter on some words we want to keep for us
      if (["api", "app", "www", "docs"].includes(opts.input.slug)) {
        return false;
      }
      const result = await opts.ctx.db.query.page.findMany({
        where: sql`lower(${page.slug}) = ${opts.input.slug}`,
      });
      return result?.length > 0 ? false : true;
    }),
});
