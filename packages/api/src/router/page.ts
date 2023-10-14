import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { analytics, trackAnalytics } from "@openstatus/analytics";
import { and, eq, inArray, not, or, sql } from "@openstatus/db";
import {
  incident,
  insertPageSchemaWithMonitors,
  monitor,
  monitorsToIncidents,
  monitorsToPages,
  page,
  pagesToIncidents,
  selectPublicPageSchemaWithRelation,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { hasUserAccessToWorkspace } from "./utils";

// TODO: deletePageById - updatePageById
export const pageRouter = createTRPCRouter({
  createPage: protectedProcedure
    .input(insertPageSchemaWithMonitors)
    .mutation(async (opts) => {
      if (!opts.input.workspaceSlug) return;
      const data = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.workspaceSlug,
        ctx: opts.ctx,
      });
      if (!data) return;

      const { monitors, workspaceId, workspaceSlug, id, ...pageInput } =
        opts.input;

      const pageNumbers = (
        await opts.ctx.db.query.page.findMany({
          where: eq(page.workspaceId, data.workspace.id),
        })
      ).length;

      const limit = data.plan.limits["status-pages"];

      // the user has reached the limits
      if (pageNumbers >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your status-page limits.",
        });
      }

      const newPage = await opts.ctx.db
        .insert(page)
        .values({ workspaceId: data.workspace.id, ...pageInput })
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

      // TODO: check, do we have to await for the two calls? Will slow down user response for our analytics
      await analytics.identify(data.user.id, {
        userId: data.user.id,
        email: data.user.email,
      });
      await trackAnalytics({
        event: "Page Created",
        slug: newPage.slug,
      });
      return newPage;
    }),

  getPageByID: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const currentUser = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .get();
      if (!currentUser) return;
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
      if (!opts.input.id) return;

      const currentUser = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .get();
      if (!currentUser) return;
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, currentUser.id))
        .all();
      const workspaceIds = result.map((workspace) => workspace.workspaceId);

      const pageToUpdate = await opts.ctx.db
        .select()
        .from(page)
        .where(
          and(
            eq(page.id, opts.input.id),
            inArray(page.workspaceId, workspaceIds),
          ),
        )
        .get();
      if (!pageToUpdate) return;

      const { monitors, workspaceSlug, ...pageInput } = opts.input;
      if (!pageInput.id) return;
      const currentPage = await opts.ctx.db
        .update(page)
        .set({ ...pageInput, updatedAt: new Date() })
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
      if (!currentUser) return;
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
      if (!currentUser) return;
      const currentWorkspace = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();
      if (!currentWorkspace) return;
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
      console.log(opts.input.slug);
      const result = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
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

      const monitorsToIncidentsResult =
        monitorsId.length > 0
          ? await opts.ctx.db
              .select()
              .from(monitorsToIncidents)
              .where(inArray(monitorsToIncidents.monitorId, monitorsId))
              .all()
          : [];

      const incidentsToPagesResult = await opts.ctx.db
        .select()
        .from(pagesToIncidents)
        .where(eq(pagesToIncidents.pageId, result.id))
        .all();

      const monitorIncidentIds = monitorsToIncidentsResult.map(
        ({ incidentId }) => incidentId,
      );

      const pageIncidentIds = incidentsToPagesResult.map(
        ({ incidentId }) => incidentId,
      );

      const incidentIds = Array.from(
        new Set([...monitorIncidentIds, ...pageIncidentIds]),
      );

      const incidents =
        incidentIds.length > 0
          ? await opts.ctx.db.query.incident.findMany({
              where: or(inArray(incident.id, incidentIds)),
              with: {
                incidentUpdates: true,
                monitorsToIncidents: true,
                pagesToIncidents: true,
              },
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

      return selectPublicPageSchemaWithRelation.parse({
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

  addCustomDomain: protectedProcedure
    .input(
      z.object({ customDomain: z.string().toLowerCase(), pageId: z.number() }),
    )
    .mutation(async (opts) => {
      // TODO Add some check ?
      await opts.ctx.db
        .update(page)
        .set({ customDomain: opts.input.customDomain })
        .where(eq(page.id, opts.input.pageId))
        .returning()
        .get();
    }),
});
