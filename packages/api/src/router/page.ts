import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

import { trackNewPage } from "../analytics";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const pageRouter = createTRPCRouter({
  create: protectedProcedure.input(insertPageSchema).mutation(async (opts) => {
    const { monitors, workspaceId, id, ...pageProps } = opts.input;

    const pageNumbers = (
      await opts.ctx.db.query.page.findMany({
        where: eq(page.workspaceId, opts.ctx.workspace.id),
      })
    ).length;

    const limit = allPlans[opts.ctx.workspace.plan].limits["status-pages"];

    // the user has reached the limits
    if (pageNumbers >= limit) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You reached your status-page limits.",
      });
    }

    const newPage = await opts.ctx.db
      .insert(page)
      .values({ workspaceId: opts.ctx.workspace.id, ...pageProps })
      .returning()
      .get();

    if (monitors && monitors.length > 0) {
      // We should make sure the user has access to the monitors
      const allMonitors = await opts.ctx.db.query.monitor.findMany({
        where: and(
          inArray(monitor.id, monitors),
          eq(monitor.workspaceId, opts.ctx.workspace.id),
        ),
      });
      const values = allMonitors.map((monitor) => ({
        monitorId: monitor.id,
        pageId: newPage.id,
      }));
      await opts.ctx.db.insert(monitorsToPages).values(values).run();
    }

    trackNewPage(opts.ctx.user, { slug: newPage.slug });

    return newPage;
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
  update: protectedProcedure.input(insertPageSchema).mutation(async (opts) => {
    const { monitors, ...pageInput } = opts.input;
    if (!pageInput.id) return;

    const currentPage = await opts.ctx.db
      .update(page)
      .set({ ...pageInput, updatedAt: new Date() })
      .where(
        and(
          eq(page.id, pageInput.id),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
      )
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
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db
        .delete(page)
        .where(
          and(
            eq(page.id, opts.input.id),
            eq(page.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .run();
    }),
  getPagesByWorkspace: protectedProcedure.query(async (opts) => {
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
