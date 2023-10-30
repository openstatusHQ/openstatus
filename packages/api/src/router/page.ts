import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { analytics, trackAnalytics } from "@openstatus/analytics";
import { and, eq, inArray, or, sql } from "@openstatus/db";
import {
  incident,
  insertPageSchema,
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

export const pageRouter = createTRPCRouter({
  upsert: protectedProcedure.input(insertPageSchema).mutation(async (opts) => {
    const { monitors, workspaceId, id, ...pageInput } = opts.input;

    const pageNumbers = (
      await opts.ctx.db.query.page.findMany({
        where: eq(page.workspaceId, opts.ctx.workspace.id),
      })
    ).length;

    const limit =
      allPlans[opts.ctx.workspace.plan || "free"].limits["status-pages"];

    // the user has reached the limits
    if (pageNumbers >= limit) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You reached your status-page limits.",
      });
    }

    const currentPage = id
      ? await opts.ctx.db
          .update(page)
          .set({ ...pageInput, updatedAt: new Date() })
          .where(eq(page.id, id))
          .returning()
          .get()
      : await opts.ctx.db
          .insert(page)
          .values({ workspaceId: opts.ctx.workspace.id, ...pageInput })
          .returning()
          .get();

    if (!id) {
      // TODO: check, do we have to await for the two calls? Will slow down user response for our analytics
      await analytics.identify(opts.ctx.user.id, {
        userId: opts.ctx.user.id,
        email: opts.ctx.user.email,
      });
      await trackAnalytics({
        event: "Page Created",
        slug: currentPage.slug,
      });
    }

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

    return currentPage;
  }),
  getPageById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      return await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.id),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
        with: {
          monitorsToPages: { with: { monitor: true } },
          // incidents: true
        },
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const pageToDelete = await opts.ctx.db
        .select()
        .from(page)
        .where(
          and(
            eq(page.id, opts.input.id),
            eq(page.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();
      if (!pageToDelete) return;

      await opts.ctx.db.delete(page).where(eq(page.id, pageToDelete.id)).run();
    }),
  getPagesByWorkspace: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async (opts) => {
      return opts.ctx.db.query.page.findMany({
        where: and(eq(page.workspaceId, opts.ctx.workspace.id)),
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
      if (
        ["api", "app", "www", "docs", "checker", "time"].includes(
          opts.input.slug,
        )
      ) {
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
