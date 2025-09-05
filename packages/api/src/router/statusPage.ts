import { z } from "zod";

import { and, eq, inArray, isNull, sql } from "@openstatus/db";
import {
  incidentTable,
  maintenance,
  monitor,
  monitorsToPages,
  page,
  pageSubscriber,
  selectPublicMonitorSchema,
  selectPublicPageSchemaWithRelation,
  statusReport,
  workspace,
} from "@openstatus/db/src/schema";

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { fillStatusDataFor45Days } from "./statusPage.utils";
import {
  getMetricsLatencyMultiProcedure,
  getMetricsLatencyProcedure,
  getMetricsRegionsProcedure,
  getStatusProcedure,
  getUptimeProcedure,
} from "./tinybird";

// NOTE: publicProcedure is used to get the status page
// TODO: improve performance of SQL query (make a single query with joins)

// IMPORTANT: we cannot use the tinybird procedure because it has protectedProcedure
// instead, we should add TB logic in here!!!!

// NOTE: this router is used on status pages only - do not confuse with the page router which is used in the dashboard for the config

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

  getStatus: publicProcedure
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        monitorIds: z.string().array(),
      }),
    )
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        with: {
          monitorsToPages: {
            where: inArray(
              monitorsToPages.monitorId,
              opts.input.monitorIds.map(Number),
            ),
            with: {
              monitor: true,
            },
          },
        },
      });

      if (!_page) return null;
      if (_page.monitorsToPages.length !== opts.input.monitorIds.length)
        return null;

      const monitorsByType = {
        http: _page.monitorsToPages.filter((m) => m.monitor.jobType === "http"),
        tcp: _page.monitorsToPages.filter((m) => m.monitor.jobType === "tcp"),
      };

      const proceduresByType = {
        http: getStatusProcedure("45d", "http"),
        tcp: getStatusProcedure("45d", "tcp"),
      };

      const [statusHttp, statusTcp] = await Promise.all(
        Object.entries(proceduresByType).map(([type, procedure]) => {
          const monitorIds = monitorsByType[
            type as keyof typeof proceduresByType
          ].map((m) => m.monitor.id.toString());
          if (monitorIds.length === 0) return null;
          return procedure({ monitorIds });
        }),
      );

      const statusDataByMonitorId = new Map<
        string,
        | Awaited<ReturnType<(typeof proceduresByType)["http"]>>["data"]
        | Awaited<ReturnType<(typeof proceduresByType)["tcp"]>>["data"]
      >();

      if (statusHttp?.data) {
        statusHttp.data.forEach((status) => {
          const monitorId = status.monitorId;
          if (!statusDataByMonitorId.has(monitorId)) {
            statusDataByMonitorId.set(monitorId, []);
          }
          statusDataByMonitorId.get(monitorId)?.push(status);
        });
      }

      if (statusTcp?.data) {
        statusTcp.data.forEach((status) => {
          const monitorId = status.monitorId;
          if (!statusDataByMonitorId.has(monitorId)) {
            statusDataByMonitorId.set(monitorId, []);
          }
          statusDataByMonitorId.get(monitorId)?.push(status);
        });
      }

      return _page.monitorsToPages.map((m) => {
        const monitorId = m.monitor.id.toString();
        const rawData = statusDataByMonitorId.get(monitorId) || [];
        const filledData = fillStatusDataFor45Days(rawData, monitorId);
        return {
          ...selectPublicMonitorSchema.parse(m.monitor),
          data: filledData,
        };
      });
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

  getMonitors: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      // NOTE: revalidate the public monitors first
      const data = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        with: {
          monitorsToPages: {
            with: {
              monitor: true,
            },
          },
        },
      });

      if (!data) return null;

      const publicMonitors = data.monitorsToPages.filter(
        (m) => m.monitor.public,
      );

      const monitorsByType = {
        http: publicMonitors.filter((m) => m.monitor.jobType === "http"),
        tcp: publicMonitors.filter((m) => m.monitor.jobType === "tcp"),
      };

      const proceduresByType = {
        http: getMetricsLatencyMultiProcedure("1d", "http"),
        tcp: getMetricsLatencyMultiProcedure("1d", "tcp"),
      };

      const [metricsLatencyMultiHttp, metricsLatencyMultiTcp] =
        await Promise.all(
          Object.entries(proceduresByType).map(([type, procedure]) => {
            const monitorIds = monitorsByType[
              type as keyof typeof proceduresByType
            ].map((m) => m.monitor.id.toString());
            if (monitorIds.length === 0) return null;
            return procedure({ monitorIds });
          }),
        );

      const metricsDataByMonitorId = new Map<
        string,
        | Awaited<ReturnType<(typeof proceduresByType)["http"]>>["data"]
        | Awaited<ReturnType<(typeof proceduresByType)["tcp"]>>["data"]
      >();

      if (metricsLatencyMultiHttp?.data) {
        metricsLatencyMultiHttp.data.forEach((metric) => {
          const monitorId = metric.monitorId;
          if (!metricsDataByMonitorId.has(monitorId)) {
            metricsDataByMonitorId.set(monitorId, []);
          }
          metricsDataByMonitorId.get(monitorId)?.push(metric);
        });
      }

      if (metricsLatencyMultiTcp?.data) {
        metricsLatencyMultiTcp.data.forEach((metric) => {
          const monitorId = metric.monitorId;
          if (!metricsDataByMonitorId.has(monitorId)) {
            metricsDataByMonitorId.set(monitorId, []);
          }
          metricsDataByMonitorId.get(monitorId)?.push(metric);
        });
      }

      return publicMonitors.map((m) => {
        const monitorId = m.monitor.id.toString();
        const data = metricsDataByMonitorId.get(monitorId) || [];

        return {
          ...selectPublicMonitorSchema.parse(m.monitor),
          data,
        };
      });
    }),

  getMonitor: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase(), id: z.number() }))
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        with: {
          monitorsToPages: {
            where: eq(monitorsToPages.monitorId, opts.input.id),
            with: {
              monitor: true,
            },
          },
        },
      });

      if (!_page) return null;

      const _monitor = _page.monitorsToPages.find(
        (m) => m.monitorId === opts.input.id,
      )?.monitor;

      if (!_monitor) return null;
      if (!_monitor.public) return null;
      if (_monitor.deletedAt) return null;

      const type = _monitor.jobType as "http" | "tcp";

      const proceduresByType = {
        http: {
          latency: getMetricsLatencyProcedure("7d", "http"),
          regions: getMetricsRegionsProcedure("7d", "http"),
          uptime: getUptimeProcedure("7d", "http"),
        },
        tcp: {
          latency: getMetricsLatencyProcedure("7d", "tcp"),
          regions: getMetricsRegionsProcedure("7d", "tcp"),
          uptime: getUptimeProcedure("7d", "tcp"),
        },
      };

      const [latency, regions, uptime] = await Promise.all([
        await proceduresByType[type].latency({
          monitorId: _monitor.id.toString(),
        }),
        await proceduresByType[type].regions({
          monitorId: _monitor.id.toString(),
        }),
        await proceduresByType[type].uptime({
          monitorId: _monitor.id.toString(),
        }),
      ]);

      return {
        ...selectPublicMonitorSchema.parse(_monitor),
        data: {
          latency,
          regions,
          uptime,
        },
      };
    }),

  subscribe: publicProcedure
    .input(
      z.object({ slug: z.string().toLowerCase(), email: z.string().email() }),
    )
    .mutation(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        with: {
          workspace: true,
        },
      });

      if (!_page) return null;

      if (_page.workspace.plan === "free") return null;

      const _alreadySubscribed =
        await opts.ctx.db.query.pageSubscriber.findFirst({
          where: and(
            eq(pageSubscriber.pageId, _page.id),
            eq(pageSubscriber.email, opts.input.email),
          ),
        });

      if (_alreadySubscribed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email already subscribed",
        });
      }

      const _pageSubscriber = await opts.ctx.db
        .insert(pageSubscriber)
        .values({
          pageId: _page.id,
          email: opts.input.email,
          token: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        })
        .returning()
        .get();

      return _pageSubscriber.id;
    }),

  verifyEmail: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase(), token: z.string() }))
    .mutation(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
      });

      if (!_page) return null;

      const _pageSubscriber = await opts.ctx.db.query.pageSubscriber.findFirst({
        where: and(
          eq(pageSubscriber.token, opts.input.token),
          eq(pageSubscriber.pageId, _page.id),
        ),
      });

      if (_pageSubscriber?.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email already verified",
        });
      }

      if (!_pageSubscriber) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      await opts.ctx.db
        .update(pageSubscriber)
        .set({
          acceptedAt: new Date(),
        })
        .where(eq(pageSubscriber.id, _pageSubscriber.id))
        .execute();

      return _pageSubscriber;
    }),

  verifyPassword: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase(), password: z.string() }))
    .mutation(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
      });

      if (!_page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      if (_page.password !== opts.input.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid password",
        });
      }

      return true;
    }),
});
