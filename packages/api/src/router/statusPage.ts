import { z } from "zod";

import { and, eq, inArray, isNull, sql } from "@openstatus/db";
import {
  incidentTable,
  maintenance,
  monitor,
  monitorsToPages,
  page,
  selectPublicMonitorSchema,
  selectPublicPageSchemaWithRelation,
  statusReport,
  workspace,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";

// NOTE: publicProcedure is used to get the status page
// TODO: improve performance of SQL query (make a single query with joins)

// IMPORTANT: we cannot use the tinybird procedure because it has protectedProcedure
// instead, we should add TB logic in here!!!!

export const statusPageRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .output(selectPublicPageSchemaWithRelation.nullish())
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const result = await opts.ctx.db
        .select()
        .from(page)
        .where(
          sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        )
        .get();

      if (!result) return null;

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
        with: { maintenancesToMonitors: { with: { monitor: true } } },
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
        maintenances,
        workspacePlan: workspaceResult?.plan,
      });
    }),

  getMaintenance: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase(), id: z.number() }))
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db
        .select()
        .from(page)
        .where(
          sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        )
        .get();

      if (!_page) return null;

      const _maintenance = await opts.ctx.db.query.maintenance.findFirst({
        where: and(
          eq(maintenance.id, opts.input.id),
          eq(maintenance.pageId, _page.id),
        ),
        with: { maintenancesToMonitors: { with: { monitor: true } } },
      });

      if (!_maintenance) return null;

      return _maintenance;
    }),

  getReport: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase(), id: z.number() }))
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db
        .select()
        .from(page)
        .where(
          sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        )
        .get();

      if (!_page) return null;

      const _report = await opts.ctx.db.query.statusReport.findFirst({
        where: and(
          eq(statusReport.id, opts.input.id),
          eq(statusReport.pageId, _page.id),
        ),
        with: {
          monitorsToStatusReports: { with: { monitor: true } },
          statusReportUpdates: {
            orderBy: (reports, { desc }) => desc(reports.date),
          },
        },
      });

      if (!_report) return null;

      return _report;
    }),

  getMonitor: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase(), id: z.number() }))
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db
        .select()
        .from(page)
        .where(
          sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        )
        .get();

      if (!_page) return null;

      const _monitor = await opts.ctx.db.query.monitor.findFirst({
        where: and(
          eq(monitor.id, opts.input.id),
          eq(monitor.public, true),
          isNull(monitor.deletedAt),
        ),
        with: {
          monitorsToPages: {
            where: eq(monitorsToPages.pageId, _page.id),
          },
        },
      });

      if (!_monitor) return null;

      if (!_monitor.monitorsToPages.some((m) => m.pageId === _page.id))
        return null;

      return selectPublicMonitorSchema.parse(_monitor);
    }),
});
