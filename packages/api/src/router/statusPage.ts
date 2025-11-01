import { z } from "zod";

import { and, eq, inArray, isNotNull, sql } from "@openstatus/db";
import {
  maintenance,
  monitorsToPages,
  page,
  pageConfigurationSchema,
  pageSubscriber,
  selectPublicMonitorSchema,
  selectPublicPageSchemaWithRelation,
  selectWorkspaceSchema,
  statusReport,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
  fillStatusDataFor45Days,
  fillStatusDataFor45DaysNoop,
  getEvents,
  getUptime,
  getWorstVariant,
  setDataByType,
} from "./statusPage.utils";
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
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        // NOTE: override the defaults we are getting from the page configuration
        cardType: z
          .enum(["requests", "duration", "dominant", "manual"])
          .nullish(),
        barType: z.enum(["absolute", "dominant", "manual"]).nullish(),
      }),
    )
    .output(selectPublicPageSchemaWithRelation.nullish())
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR lower(${page.customDomain}) = ${opts.input.slug}`,
        with: {
          workspace: true,
          statusReports: {
            // TODO: we need to order the based on statusReportUpdates instead
            // orderBy: (reports, { desc }) => desc(reports.createdAt),
            with: {
              statusReportUpdates: {
                orderBy: (reports, { desc }) => desc(reports.date),
              },
              monitorsToStatusReports: { with: { monitor: true } },
            },
          },
          maintenances: {
            with: {
              maintenancesToMonitors: { with: { monitor: true } },
            },
            orderBy: (maintenances, { desc }) => desc(maintenances.from),
          },
          monitorsToPages: {
            with: {
              monitor: {
                with: {
                  incidents: true,
                },
              },
              monitorGroup: true,
            },
            orderBy: (monitorsToPages, { asc }) => asc(monitorsToPages.order),
          },
        },
      });

      if (!_page) return null;

      const configuration = pageConfigurationSchema.safeParse(
        _page.configuration ?? {},
      );

      if (!configuration.success) {
        console.error("Invalid configuration", configuration.error);
        return null;
      }

      const barType = opts.input.barType ?? configuration.data.type;
      // const cardType = opts.input.cardType ?? configuration.data.value;

      const monitors = _page.monitorsToPages
        // NOTE: we cannot nested `where` in drizzle to filter active monitors
        .filter((m) => !m.monitor.deletedAt)
        .map((m) => {
          const events = getEvents({
            maintenances: _page.maintenances,
            incidents: m.monitor.incidents,
            reports: _page.statusReports,
            monitorId: m.monitor.id,
          });
          const status =
            events.some((e) => e.type === "incident" && !e.to) &&
            barType !== "manual"
              ? "error"
              : events.some((e) => e.type === "report" && !e.to)
                ? "degraded"
                : events.some(
                      (e) =>
                        e.type === "maintenance" &&
                        e.to &&
                        e.from.getTime() <= new Date().getTime() &&
                        e.to.getTime() >= new Date().getTime(),
                    )
                  ? "info"
                  : "success";
          return {
            ...m.monitor,
            status,
            events,
            monitorGroupId: m.monitorGroupId,
            order: m.order,
            groupOrder: m.groupOrder,
          };
        });

      const status =
        monitors.some((m) => m.status === "error") && barType !== "manual"
          ? "error"
          : monitors.some((m) => m.status === "degraded")
            ? "degraded"
            : monitors.some((m) => m.status === "info")
              ? "info"
              : "success";

      // Get page-wide events (not tied to specific monitors)
      const pageEvents = getEvents({
        maintenances: _page.maintenances,
        incidents:
          _page.monitorsToPages.flatMap((m) => m.monitor.incidents) ?? [],
        reports: _page.statusReports,
        // No monitorId provided, so we get all events for the page
      });

      const threshold = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
      const lastEvents = pageEvents
        .filter((e) => {
          if (e.type === "incident") return false;
          if (!e.from || e.from.getTime() >= threshold) return true;
          if (e.type === "report" && e.status !== "success") return true;
          return false;
        })
        .sort((a, b) => a.from.getTime() - b.from.getTime());

      const openEvents = pageEvents.filter((event) => {
        if (event.type === "incident" && barType !== "manual") {
          if (!event.to) return true;
          if (event.to < new Date()) return false;
          return false;
        }
        if (event.type === "report") {
          if (!event.to) return true;
          if (event.to < new Date()) return false;
          return false;
        }
        if (event.type === "maintenance") {
          if (!event.to) return false; // NOTE: this never happens
          if (event.from <= new Date() && event.to >= new Date()) return true;
          return false;
        }
        return false;
      });

      const monitorGroups = Array.from(
        new Map(
          _page.monitorsToPages.map((m) => [
            m.monitorGroup?.id,
            m.monitorGroup,
          ]),
        )
          .values()
          .filter(Boolean),
      );

      // Create trackers array with grouped and ungrouped monitors
      const groupedMap = new Map<
        number | null,
        {
          groupId: number | null;
          groupName: string | null;
          monitors: typeof monitors;
          minOrder: number;
        }
      >();

      monitors.forEach((monitor) => {
        const groupId = monitor.monitorGroupId ?? null;
        const group = groupId
          ? monitorGroups.find((g) => g?.id === groupId)
          : null;
        const groupName = group?.name ?? null;

        if (!groupedMap.has(groupId)) {
          groupedMap.set(groupId, {
            groupId,
            groupName,
            monitors: [],
            minOrder: monitor.order ?? 0,
          });
        }
        const currentGroup = groupedMap.get(groupId);
        if (currentGroup) {
          currentGroup.monitors.push(monitor);
          currentGroup.minOrder = Math.min(
            currentGroup.minOrder,
            monitor.order ?? 0,
          );
        }
      });

      // Convert to trackers array
      type MonitorTracker = {
        type: "monitor";
        monitor: (typeof monitors)[number];
        order: number;
      };

      type GroupTracker = {
        type: "group";
        groupId: number;
        groupName: string;
        monitors: typeof monitors;
        status: "success" | "degraded" | "error" | "info" | "empty";
        order: number;
      };

      type Tracker = MonitorTracker | GroupTracker;

      const trackers: Tracker[] = Array.from(groupedMap.values())
        .flatMap((group): Tracker[] => {
          if (group.groupId === null) {
            // Ungrouped monitors - return as individual trackers
            return group.monitors.map(
              (monitor): MonitorTracker => ({
                type: "monitor",
                monitor,
                order: monitor.order ?? 0,
              }),
            );
          }
          // Grouped monitors - return as single group tracker
          const sortedMonitors = group.monitors.sort(
            (a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0),
          );
          return [
            {
              type: "group",
              groupId: group.groupId,
              groupName: group.groupName ?? "",
              monitors: sortedMonitors,
              status: getWorstVariant(
                group.monitors.map(
                  (m) => m.status as "success" | "degraded" | "error" | "info",
                ),
              ),
              order: group.minOrder,
            },
          ];
        })
        .sort((a, b) => a.order - b.order);

      return selectPublicPageSchemaWithRelation.parse({
        ..._page,
        monitors,
        monitorGroups,
        trackers,
        incidents: monitors.flatMap((m) => m.incidents) ?? [],
        statusReports:
          // NOTE: we need to sort the status reports by the first update date
          _page.statusReports.sort((a, b) => {
            if (a.statusReportUpdates.length === 0) return -1;
            if (b.statusReportUpdates.length === 0) return -1;
            return (
              b.statusReportUpdates[
                b.statusReportUpdates.length - 1
              ].date.getTime() -
              a.statusReportUpdates[
                a.statusReportUpdates.length - 1
              ].date.getTime()
            );
          }) ?? [],
        maintenances: _page.maintenances ?? [],
        workspacePlan: _page.workspace.plan,
        status,
        lastEvents,
        openEvents,
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

  getUptime: publicProcedure
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        monitorIds: z.string().array(),
        cardType: z
          .enum(["requests", "duration", "dominant", "manual"])
          .default("requests"),
        barType: z.enum(["absolute", "dominant", "manual"]).default("dominant"),
      }),
    )
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
        with: {
          maintenances: {
            with: {
              maintenancesToMonitors: true,
            },
          },
          statusReports: {
            with: {
              monitorsToStatusReports: true,
              statusReportUpdates: true,
            },
          },
          monitorsToPages: {
            where: inArray(
              monitorsToPages.monitorId,
              opts.input.monitorIds.map(Number),
            ),
            with: {
              monitor: {
                with: {
                  incidents: true,
                },
              },
            },
          },
        },
      });

      if (!_page) return null;

      const monitors = _page.monitorsToPages.filter(
        (m) => !m.monitor.deletedAt,
      );

      if (monitors.length !== opts.input.monitorIds.length) return null;

      const monitorsByType = {
        http: monitors.filter((m) => m.monitor.jobType === "http"),
        tcp: monitors.filter((m) => m.monitor.jobType === "tcp"),
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
          // NOTE: if manual mode, don't fetch data from tinybird
          return opts.input.barType === "manual"
            ? null
            : procedure({ monitorIds });
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

      return monitors.map((m) => {
        const monitorId = m.monitor.id.toString();
        const events = getEvents({
          maintenances: _page.maintenances,
          incidents: m.monitor.incidents,
          reports: _page.statusReports,
          monitorId: m.monitor.id,
        });
        const rawData = statusDataByMonitorId.get(monitorId) || [];
        const filledData =
          process.env.NOOP_UPTIME === "true"
            ? fillStatusDataFor45DaysNoop({ errorDays: [], degradedDays: [] })
            : fillStatusDataFor45Days(rawData, monitorId);
        const processedData = setDataByType({
          events,
          data: filledData,
          cardType: opts.input.cardType,
          barType: opts.input.barType,
        });
        const uptime = getUptime({
          data: filledData,
          events,
          barType: opts.input.barType,
          cardType: opts.input.cardType,
        });

        return {
          ...selectPublicMonitorSchema.parse(m.monitor),
          data: processedData,
          uptime,
        };
      });
    }),

  // NOTE: used for the theme store
  getNoopUptime: publicProcedure.query(async () => {
    const data = fillStatusDataFor45DaysNoop({
      errorDays: [4],
      degradedDays: [40],
    });
    const processedData = setDataByType({
      events: [
        {
          type: "maintenance",
          from: new Date(new Date().setDate(new Date().getDate() - 10)),
          to: new Date(new Date().setDate(new Date().getDate() - 10)),
          name: "DB migration",
          id: 1,
          status: "info",
        },
      ],
      data,
      cardType: "requests",
      barType: "dominant",
    });
    return {
      data: processedData,
      uptime: "100%",
    };
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

  getNoopReport: publicProcedure.query(async () => {
    const date = new Date(new Date().setDate(new Date().getDate() - 4));

    const resolvedDate = new Date(date.setMinutes(date.getMinutes() - 81));
    const monitoringDate = new Date(date.setMinutes(date.getMinutes() - 54));
    const identifiedDate = new Date(date.setMinutes(date.getMinutes() - 32));
    const investigatingDate = new Date(date.setMinutes(date.getMinutes() - 4));

    return {
      id: 1,
      pageId: 1,
      status: "investigating" as const,
      title: "API Latency Issues",
      message: "We are currently investigating elevated API response times.",
      createdAt: new Date(new Date().setDate(new Date().getDate() - 2)),
      updatedAt: new Date(new Date().setDate(new Date().getDate() - 1)),
      monitorsToStatusReports: [
        {
          monitorId: 1,
          statusReportId: 1,
          monitor: {
            id: 1,
            jobType: "http" as const,
            periodicity: "30s" as const,
            status: "active" as const,
            active: true,
            regions: ["ams", "fra"],
            url: "https://api.example.com",
            name: "API Monitor",
            description: "Main API endpoint",
            headers: null,
            body: null,
            method: "GET" as const,
            public: true,
            deletedAt: null,
            createdAt: new Date(new Date().setDate(new Date().getDate() - 30)),
            updatedAt: new Date(new Date().setDate(new Date().getDate() - 30)),
            workspaceId: 1,
            timeout: 30000,
            degradedAfter: null,
            assertions: null,
          },
        },
      ],
      statusReportUpdates: [
        {
          id: 4,
          statusReportId: 1,
          status: "resolved" as const,
          message:
            "All systems are operating normally. The issue has been fully resolved.",
          date: resolvedDate,
          createdAt: resolvedDate,
          updatedAt: resolvedDate,
        },
        {
          id: 3,
          statusReportId: 1,
          status: "monitoring" as const,
          message:
            "We are continuing to monitor the situation to ensure that the issue is resolved.",
          date: monitoringDate,
          createdAt: monitoringDate,
          updatedAt: monitoringDate,
        },
        {
          id: 2,
          statusReportId: 1,
          status: "identified" as const,
          message: "The issue has been identified and a fix is being deployed.",
          date: identifiedDate,
          createdAt: identifiedDate,
          updatedAt: identifiedDate,
        },
        {
          id: 1,
          statusReportId: 1,
          status: "investigating" as const,
          message:
            "We are investigating reports of increased latency on our API endpoints.",
          date: investigatingDate,
          createdAt: investigatingDate,
          updatedAt: investigatingDate,
        },
      ],
    };
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
          interval: 240,
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
    .meta({ track: Events.SubscribePage, trackProps: ["slug", "email"] })
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

      if (!_page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      const workspace = selectWorkspaceSchema.safeParse(_page.workspace);

      if (!workspace.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workspace data is invalid",
        });
      }

      if (!workspace.data.limits["status-subscribers"]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Upgrade to use status subscribers",
        });
      }

      const _alreadySubscribed =
        await opts.ctx.db.query.pageSubscriber.findFirst({
          where: and(
            eq(pageSubscriber.pageId, _page.id),
            eq(pageSubscriber.email, opts.input.email),
            isNotNull(pageSubscriber.acceptedAt),
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
    .meta({ track: Events.VerifySubscribePage, trackProps: ["slug"] })
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
