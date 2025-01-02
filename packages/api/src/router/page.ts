import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, gte, inArray, isNull, lte, sql } from "@openstatus/db";
import {
  incidentTable,
  insertPageSchema,
  maintenance,
  monitor,
  monitorsToPages,
  page,
  selectPageSchemaWithMonitorsRelation,
  selectPublicPageSchemaWithRelation,
  statusReport,
  subdomainSafeList,
  workspace,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const pageRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreatePage, trackProps: ["slug"] })
    .input(insertPageSchema)
    .mutation(async (opts) => {
      const { monitors, workspaceId, id, ...pageProps } = opts.input;

      const monitorIds = monitors?.map((item) => item.monitorId) || [];

      const pageNumbers = (
        await opts.ctx.db.query.page.findMany({
          where: eq(page.workspaceId, opts.ctx.workspace.id),
        })
      ).length;

      const limit = opts.ctx.workspace.limits;

      // the user has reached the status page number limits
      if (pageNumbers >= limit["status-pages"]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your status-page limits.",
        });
      }

      // the user is not eligible for password protection
      if (
        limit["password-protection"] === false &&
        opts.input.passwordProtected === true
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Password protection is not available for your current plan.",
        });
      }

      const newPage = await opts.ctx.db
        .insert(page)
        .values({ workspaceId: opts.ctx.workspace.id, ...pageProps })
        .returning()
        .get();

      if (monitorIds.length) {
        // We should make sure the user has access to the monitors
        const allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt),
          ),
        });

        if (allMonitors.length !== monitorIds.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to all the monitors.",
          });
        }

        const values = monitors.map(({ monitorId }, index) => ({
          pageId: newPage.id,
          order: index,
          monitorId,
        }));

        await opts.ctx.db.insert(monitorsToPages).values(values).run();
      }

      return newPage;
    }),
  getPageById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const firstPage = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.id),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
        with: {
          monitorsToPages: {
            with: { monitor: true },
            orderBy: (monitorsToPages, { asc }) => [asc(monitorsToPages.order)],
          },
        },
      });
      return selectPageSchemaWithMonitorsRelation.parse(firstPage);
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdatePage })
    .input(insertPageSchema)
    .mutation(async (opts) => {
      const { monitors, ...pageInput } = opts.input;
      if (!pageInput.id) return;

      const monitorIds = monitors?.map((item) => item.monitorId) || [];

      const limit = opts.ctx.workspace.limits;

      // the user is not eligible for password protection
      if (
        limit["password-protection"] === false &&
        opts.input.passwordProtected === true
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Password protection is not available for your current plan.",
        });
      }

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

      if (monitorIds.length) {
        // We should make sure the user has access to the monitors
        const allMonitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt),
          ),
        });

        if (allMonitors.length !== monitorIds.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to all the monitors.",
          });
        }
      }

      // TODO: check for monitor order!
      const currentMonitorsToPages = await opts.ctx.db
        .select()
        .from(monitorsToPages)
        .where(eq(monitorsToPages.pageId, currentPage.id))
        .all();

      const removedMonitors = currentMonitorsToPages
        .map(({ monitorId }) => monitorId)
        .filter((x) => !monitorIds?.includes(x));

      if (removedMonitors.length) {
        await opts.ctx.db
          .delete(monitorsToPages)
          .where(
            and(
              inArray(monitorsToPages.monitorId, removedMonitors),
              eq(monitorsToPages.pageId, currentPage.id),
            ),
          );
      }

      const values = monitors.map(({ monitorId }, index) => ({
        pageId: currentPage.id,
        order: index,
        monitorId,
      }));

      if (values.length) {
        await opts.ctx.db
          .insert(monitorsToPages)
          .values(values)
          .onConflictDoUpdate({
            target: [monitorsToPages.monitorId, monitorsToPages.pageId],
            set: { order: sql.raw("excluded.`order`") },
          });
      }
    }),
  delete: protectedProcedure
    .meta({ track: Events.DeletePage })
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
    const allPages = await opts.ctx.db.query.page.findMany({
      where: and(eq(page.workspaceId, opts.ctx.workspace.id)),
      with: {
        monitorsToPages: { with: { monitor: true } },
        maintenancesToPages: {
          where: and(
            lte(maintenance.from, new Date()),
            gte(maintenance.to, new Date()),
          ),
        },
        statusReports: {
          orderBy: (reports, { desc }) => desc(reports.updatedAt),
          with: {
            statusReportUpdates: {
              orderBy: (updates, { desc }) => desc(updates.date),
            },
          },
        },
      },
    });
    console.log(allPages.map((page) => page.statusReports));
    return z.array(selectPageSchemaWithMonitorsRelation).parse(allPages);
  }),

  // public if we use trpc hooks to get the page from the url
  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .output(selectPublicPageSchemaWithRelation.optional())
    .query(async (opts) => {
      if (!opts.input.slug) return;

      const result = await opts.ctx.db
        .select()
        .from(page)
        .where(
          sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        )
        .get();

      if (!result) {
        return;
      }

      const [workspaceResult, monitorsToPagesResult] = await Promise.all([
        opts.ctx.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, result.workspaceId))
          .get(),
        opts.ctx.db
          .select()
          .from(monitorsToPages)
          .leftJoin(monitor, eq(monitorsToPages.monitorId, monitor.id))
          .where(
            // make sur only active monitors are returned!
            and(
              eq(monitorsToPages.pageId, result.id),
              eq(monitor.active, true),
            ),
          )
          .all(),
      ]);

      // FIXME: There is probably a better way to do this

      const monitorsId = monitorsToPagesResult.map(
        ({ monitors_to_pages }) => monitors_to_pages.monitorId,
      );

      const statusReports = await opts.ctx.db.query.statusReport.findMany({
        where: eq(statusReport.pageId, result.id),
        with: {
          statusReportUpdates: {
            orderBy: (reports, { desc }) => desc(reports.date),
          },
          monitorsToStatusReports: { with: { monitor: true } },
        },
      });

      const monitorQuery =
        monitorsId.length > 0
          ? opts.ctx.db
              .select()
              .from(monitor)
              .where(
                and(
                  inArray(monitor.id, monitorsId),
                  eq(monitor.active, true),
                  isNull(monitor.deletedAt),
                ), // REMINDER: this is hardcoded
              )
              .all()
          : [];

      const maintenancesQuery = opts.ctx.db.query.maintenance.findMany({
        where: eq(maintenance.pageId, result.id),
        with: { maintenancesToMonitors: true },
        orderBy: (maintenances, { desc }) => desc(maintenances.from),
      });

      const incidentsQuery =
        monitorsId.length > 0
          ? await opts.ctx.db
              .select()
              .from(incidentTable)
              .where(inArray(incidentTable.monitorId, monitorsId))
              .all()
          : [];
      // TODO: monitorsToPagesResult has the result already, no need to query again
      const [monitors, maintenances, incidents] = await Promise.all([
        monitorQuery,
        maintenancesQuery,
        incidentsQuery,
      ]);

      return selectPublicPageSchemaWithRelation.parse({
        ...result,
        // TODO: improve performance and move into SQLite query
        monitors: monitors.sort((a, b) => {
          const aIndex =
            monitorsToPagesResult.find((m) => m.monitor?.id === a.id)
              ?.monitors_to_pages.order || 0;
          const bIndex =
            monitorsToPagesResult.find((m) => m.monitor?.id === b.id)
              ?.monitors_to_pages.order || 0;
          return aIndex - bIndex;
        }),
        incidents,
        statusReports,
        maintenances: maintenances.map((m) => ({
          ...m,
          monitors: m.maintenancesToMonitors.map((m) => m.monitorId),
        })),
        workspacePlan: workspaceResult?.plan,
      });
    }),

  getSlugUniqueness: protectedProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .query(async (opts) => {
      // had filter on some words we want to keep for us
      if (subdomainSafeList.includes(opts.input.slug)) {
        return false;
      }
      const result = await opts.ctx.db.query.page.findMany({
        where: sql`lower(${page.slug}) = ${opts.input.slug}`,
      });
      return !(result?.length > 0);
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

  isPageLimitReached: protectedProcedure.query(async (opts) => {
    const pageLimit = opts.ctx.workspace.limits["status-pages"];
    const pageNumbers = (
      await opts.ctx.db.query.page.findMany({
        where: eq(monitor.workspaceId, opts.ctx.workspace.id),
      })
    ).length;

    return pageNumbers >= pageLimit;
  }),
});
