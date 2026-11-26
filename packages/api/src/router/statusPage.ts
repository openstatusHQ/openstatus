import { Events } from "@openstatus/analytics";
import {
  pageCardValues,
  pageConfigurationSchema,
  selectMaintenancePageSchema,
  selectPageComponentWithMonitorRelation,
  selectPublicMonitorSchema,
  selectPublicPageLightSchemaWithRelation,
  selectPublicPageSchemaWithRelation,
  selectStatusReportPageSchema,
  selectWorkspaceSchema,
  timeZoneSchema,
} from "@openstatus/db/src/schema";
import { countsRuns } from "@openstatus/services/frozen-uptime";
import { getStatusUpdateTypes } from "@openstatus/services/page";
import {
  getSubscriberByToken,
  hasPendingSubscriber,
  sendSubscriberVerification,
  unsubscribeSubscriber,
  updateSubscriberScope,
  upsertSelfSignupSubscriber,
  verifySelfSignupSubscriber,
} from "@openstatus/services/page-subscriber";
import {
  checkPublicEmailDomain,
  getPublicMaintenance,
  getPublicStatusPage,
  getPublicStatusPageGate,
  getPublicStatusPageLight,
  getPublicStatusPageMonitor,
  getPublicStatusPageUptime,
  getPublicStatusReport,
  getPublicSubscriptionPage,
  InvalidPagePasswordError,
  isPublicStatusPagePasswordAuthorized,
  listPublicStatusPageMonitors,
  verifyPublicStatusPagePassword,
} from "@openstatus/services/public-status-page";
import { TRPCError } from "@trpc/server";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { z } from "zod";

import { visitorFromCtx } from "../lib/page-access";
import { pagePasswordRateLimit } from "../lib/page-password-rate-limit";
import { toTRPCError } from "../service-adapter";
import { cachedPipe } from "../tb-cache";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
  type StatusData,
  activeReportStatus,
  fetchByJobType,
  fillStatusDataFor45Days,
  fillStatusDataFor45DaysNoop,
  getEvents,
  getUptime,
  getWorstVariant,
  isMonitorComponent,
  setDataByType,
  withTinybirdFallback,
} from "./statusPage.utils";
import {
  getMetricsLatencyMultiProcedure,
  getMetricsLatencyProcedure,
  getMetricsRegionsProcedure,
  getStatusInTimeZoneProcedure,
  getRunsProcedure,
  getStatusProcedure,
  getUptimeProcedure,
} from "./tinybird";

// Matches the status page's client staleTime; every viewer shares one read.
const PUBLIC_STATUS_TTL = 60;
// 7-day charts barely move within a few minutes.
const PUBLIC_METRICS_TTL = 300;

// Visibility is per page: project the component's flag onto its monitor so
// nothing downstream reads the deprecated `monitor.public` column.
function parsePageComponents(raw: unknown) {
  return selectPageComponentWithMonitorRelation
    .array()
    .parse(raw)
    .map((c) =>
      c.monitor ? { ...c, monitor: { ...c.monitor, public: c.public } } : c,
    );
}

function monitorMetricsProcedures(
  type: "http" | "tcp" | "dns" | "icmp" | "grpc",
) {
  return {
    latency: cachedPipe(
      `latency7d:${type}`,
      getMetricsLatencyProcedure("7d", type),
      PUBLIC_METRICS_TTL,
    ),
    regions: cachedPipe(
      `regions7d:${type}`,
      getMetricsRegionsProcedure("7d", type),
      PUBLIC_METRICS_TTL,
    ),
    uptime: cachedPipe(
      `uptime7d:${type}`,
      getUptimeProcedure("7d", type),
      PUBLIC_METRICS_TTL,
    ),
  };
}

// NOTE: publicProcedure is used to get the status page
// TODO: improve performance of SQL query (make a single query with joins)

// IMPORTANT: we cannot use the tinybird procedure because it has protectedProcedure
// instead, we should add TB logic in here!!!!

// NOTE: this router is used on status pages only - do not confuse with the page router which is used in the dashboard for the config

// Password for cookie-less server callers (feeds, `?pw=` links).
const queryPasswordSchema = z.string().nullish();
const cardTypeSchema = z.enum([...pageCardValues, "dominant"]);

async function callVisitorVerb<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    toTRPCError(err);
  }
}

export function sortStatusReportsByLatestUpdate<
  T extends { id: number; statusReportUpdates: { date: Date }[] },
>(a: T, b: T): number {
  // Sort reports without updates to the beginning
  if (a.statusReportUpdates.length === 0 && b.statusReportUpdates.length === 0)
    return b.id - a.id;
  if (a.statusReportUpdates.length === 0) return -1;
  if (b.statusReportUpdates.length === 0) return 1;
  return (
    b.statusReportUpdates[0].date.getTime() -
      a.statusReportUpdates[0].date.getTime() || b.id - a.id
  );
}

type StatusMonitors = Parameters<typeof fetchByJobType>[0];

function readStatus(monitors: StatusMonitors, timeZone: string) {
  // UTC pages keep the 45d pipes; other zones regroup 15m buckets into their days
  if (timeZone === "UTC") {
    return fetchByJobType(monitors, (type) =>
      cachedPipe(
        `status45d:${type}`,
        getStatusProcedure("45d", type),
        PUBLIC_STATUS_TTL,
      ),
    );
  }
  return fetchByJobType(
    monitors,
    (type) =>
      ({ monitorIds }) =>
        cachedPipe(
          `status15m:${type}`,
          getStatusInTimeZoneProcedure(type),
          PUBLIC_STATUS_TTL,
        )({ monitorIds, timezone: timeZone }),
  );
}

function readRuns(monitors: StatusMonitors, timeZone: string) {
  return fetchByJobType(monitors, (type) => {
    const procedure = getRunsProcedure(type);
    if (!procedure) return null;
    // the pipe's UTC query runs only when `timezone` is absent
    return ({ monitorIds }) =>
      procedure(
        timeZone === "UTC"
          ? { monitorIds }
          : { monitorIds, timezone: timeZone },
      );
  });
}

// Status rows grouped into `timeZone` days, with the zone they ended up in.
// Runs mode reads run verdicts for monitors that get them, counts for the rest.
async function fetchStatusDays(
  monitors: (StatusMonitors[number] & {
    monitor: { regions: readonly string[] };
  })[],
  timeZone: string,
  cardType: string,
) {
  const readIn = async (zone: string) => {
    if (cardType !== "runs") return readStatus(monitors, zone);
    const runsGroup = monitors.filter((c) => countsRuns(c.monitor));
    const rest = monitors.filter((c) => !countsRuns(c.monitor));
    const [runs, status] = await Promise.all([
      readRuns(runsGroup, zone),
      readStatus(rest, zone),
    ]);
    return new Map([...status, ...runs]);
  };
  if (timeZone === "UTC") return { timeZone: "UTC", rows: await readIn("UTC") };
  try {
    return { timeZone, rows: await readIn(timeZone) };
  } catch (err) {
    // ClickHouse's tz database can reject a zone Node accepts: keep real bars
    // in UTC days; other errors still drop the page to manual mode
    if (!(err instanceof Error) || !/time ?zone/i.test(err.message)) throw err;
    console.error(
      `[status-page] zone ${timeZone} failed, using UTC days:`,
      err,
    );
    return { timeZone: "UTC", rows: await readIn("UTC") };
  }
}

export const statusPageRouter = createTRPCRouter({
  get: publicProcedure
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        pw: queryPasswordSchema,
        // NOTE: override the defaults we are getting from the page configuration
        cardType: cardTypeSchema.nullish(),
        barType: z.enum(["absolute", "dominant", "manual"]).nullish(),
      }),
    )
    .output(selectPublicPageSchemaWithRelation.nullish())
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const result = await getPublicStatusPage({
        input: { slug: opts.input.slug },
        visitor: visitorFromCtx(opts.ctx, opts.input.pw),
      });
      if (!result) return null;
      const { page: _page, privateLocationCounts } = result;

      const ws = selectWorkspaceSchema.safeParse(_page.workspace);
      const pageComponents = parsePageComponents(_page.pageComponents);

      const configuration = pageConfigurationSchema.safeParse(
        _page.configuration ?? {},
      );

      if (!configuration.success) {
        console.error("Invalid configuration", configuration.error);
        return null;
      }

      const barType = opts.input.barType ?? configuration.data.type;
      // const cardType = opts.input.cardType ?? configuration.data.value;

      const monitorComponents = pageComponents.filter(isMonitorComponent);

      // Transform all page components (both monitor and static types)
      const components = pageComponents.map((c) => {
        const events = getEvents({
          maintenances: _page.maintenances,
          incidents: c.monitor?.monitorIncidents ?? [],
          reports: _page.statusReports,
          pageComponentId: c.id,
          monitorId: c.monitorId ?? undefined,
          componentType: c.type,
        });

        // Calculate status based on component type
        let status: "success" | "degraded" | "error" | "info";

        // impact-aware: an active report colors the component by its derived
        // status (major ⇒ error); legacy reports keep flat degraded
        const reportStatus = activeReportStatus(events);

        if (c.type === "static") {
          // Static: only reports and maintenances affect status
          status =
            reportStatus ??
            (events.some(
              (e) =>
                e.type === "maintenance" &&
                e.to &&
                e.from.getTime() <= new Date().getTime() &&
                e.to.getTime() >= new Date().getTime(),
            )
              ? "info"
              : "success");
        } else {
          // Monitor: incidents, reports, and maintenances affect status
          status =
            events.some((e) => e.type === "incident" && !e.to) &&
            barType !== "manual"
              ? "error"
              : (reportStatus ??
                (events.some(
                  (e) =>
                    e.type === "maintenance" &&
                    e.to &&
                    e.from.getTime() <= new Date().getTime() &&
                    e.to.getTime() >= new Date().getTime(),
                )
                  ? "info"
                  : "success"));
        }

        return {
          ...c,
          status,
          events,
        };
      });

      // Keep monitors for backward compatibility with existing fields
      const monitors = monitorComponents.map((c) => {
        const events = getEvents({
          maintenances: _page.maintenances,
          incidents: c.monitor.monitorIncidents ?? [],
          reports: _page.statusReports,
          monitorId: c.monitor.id,
        });
        const status =
          events.some((e) => e.type === "incident" && !e.to) &&
          barType !== "manual"
            ? "error"
            : (activeReportStatus(events) ??
              (events.some(
                (e) =>
                  e.type === "maintenance" &&
                  e.to &&
                  e.from.getTime() <= new Date().getTime() &&
                  e.to.getTime() >= new Date().getTime(),
              )
                ? "info"
                : "success"));
        return {
          ...c.monitor,
          public: c.public,
          status,
          events,
          monitorGroupId: c.groupId,
          order: c.order,
          groupOrder: c.groupOrder,
        };
      });

      // Create new array with privateLocationCount included (no mutation/cast)
      const monitorsWithPrivateLocationCount = monitors.map((m) => ({
        ...m,
        privateLocationCount: privateLocationCounts.get(m.id) ?? 0,
      }));

      // Sort monitors to match trackers behavior: group by monitorGroupId, order
      // groups by minimum order, sort within groups by groupOrder, and sort
      // ungrouped monitors by order
      const groupMinOrderMap = new Map<number, number>();
      for (const monitor of monitorsWithPrivateLocationCount) {
        const groupId = monitor.monitorGroupId;
        if (groupId !== null) {
          const order = monitor.order ?? 0;
          const currentMin =
            groupMinOrderMap.get(groupId) ?? Number.MAX_SAFE_INTEGER;
          groupMinOrderMap.set(groupId, Math.min(currentMin, order));
        }
      }

      monitorsWithPrivateLocationCount.sort((a, b) => {
        const aGroupId = a.monitorGroupId ?? null;
        const bGroupId = b.monitorGroupId ?? null;

        // If both monitors are in the same group (or both ungrouped with null)
        if (aGroupId === bGroupId) {
          if (aGroupId === null) {
            // Both ungrouped - sort by order
            return (a.order ?? 0) - (b.order ?? 0);
          }
          // Both in same group - sort by groupOrder within the group
          return (a.groupOrder ?? 0) - (b.groupOrder ?? 0);
        }

        // Different groups or one is ungrouped - sort by group position
        // For grouped monitors, use precomputed minimum order of the group
        // For ungrouped monitors, use their own order
        const aGroupMinOrder =
          aGroupId !== null
            ? (groupMinOrderMap.get(aGroupId) ?? 0)
            : (a.order ?? 0);
        const bGroupMinOrder =
          bGroupId !== null
            ? (groupMinOrderMap.get(bGroupId) ?? 0)
            : (b.order ?? 0);

        return aGroupMinOrder - bGroupMinOrder;
      });

      // no barType gate: incident-driven error is already suppressed per
      // monitor in manual mode; report-driven error (major_outage) must show
      const status = monitorsWithPrivateLocationCount.some(
        (m) => m.status === "error",
      )
        ? "error"
        : monitorsWithPrivateLocationCount.some((m) => m.status === "degraded")
          ? "degraded"
          : monitorsWithPrivateLocationCount.some((m) => m.status === "info")
            ? "info"
            : "success";

      // Get page-wide events (not tied to specific monitors)
      const pageEvents = getEvents({
        maintenances: _page.maintenances,
        incidents: monitorComponents.flatMap(
          (c) => c.monitor.monitorIncidents ?? [],
        ),
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

      const monitorGroups = _page.pageComponentGroups;

      // Create trackers array with grouped and ungrouped components
      const groupedMap = new Map<
        number | null,
        {
          groupId: number | null;
          groupName: string | null;
          defaultOpen: boolean;
          components: typeof components;
          minOrder: number;
        }
      >();

      components.forEach((component) => {
        const groupId = component.groupId ?? null;
        const group = groupId
          ? monitorGroups.find((g) => g?.id === groupId)
          : null;
        const groupName = group?.name ?? null;
        const defaultOpen = group?.defaultOpen ?? false;

        if (!groupedMap.has(groupId)) {
          groupedMap.set(groupId, {
            groupId,
            groupName,
            defaultOpen,
            components: [],
            minOrder: component.order ?? 0,
          });
        }
        const currentGroup = groupedMap.get(groupId);
        if (currentGroup) {
          currentGroup.components.push(component);
          currentGroup.minOrder = Math.min(
            currentGroup.minOrder,
            component.order ?? 0,
          );
        }
      });

      // Convert to trackers array
      type PageComponentTracker = {
        type: "component";
        component: (typeof components)[number];
        order: number;
      };

      type GroupTracker = {
        type: "group";
        groupId: number;
        groupName: string;
        defaultOpen: boolean;
        components: typeof components;
        status: "success" | "degraded" | "error" | "info" | "empty";
        order: number;
      };

      type Tracker = PageComponentTracker | GroupTracker;

      const trackers: Tracker[] = Array.from(groupedMap.values())
        .flatMap((group): Tracker[] => {
          if (group.groupId === null) {
            // Ungrouped components - return as individual trackers
            return group.components.map((component): PageComponentTracker => ({
              type: "component",
              component,
              order: component.order ?? 0,
            }));
          }
          // Grouped components - return as single group tracker
          const sortedComponents = group.components.sort(
            (a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0),
          );
          return [
            {
              type: "group",
              groupId: group.groupId,
              groupName: group.groupName ?? "",
              defaultOpen: group.defaultOpen,
              components: sortedComponents,
              status: getWorstVariant(
                group.components.map(
                  (c) => c.status as "success" | "degraded" | "error" | "info",
                ),
              ),
              order: group.minOrder,
            },
          ];
        })
        .sort((a, b) => a.order - b.order);

      const whiteLabel = ws.data?.limits["white-label"] ?? false;
      // stored custom theme stops applying when the plan no longer includes it
      const customTheme = ws.data?.limits["custom-theme"]
        ? _page.customTheme
        : null;

      const statusReports = _page.statusReports.sort(
        sortStatusReportsByLatestUpdate,
      );

      const maintenances = _page.maintenances.sort(
        (a, b) => b.from.getTime() - a.from.getTime(),
      );

      // In "manual" mode the page only surfaces user-authored events, so drop
      // monitor-derived incidents from the components consumers read (e.g. the
      // calendar). Mirrors the bar/uptime gating in statusPage.utils.ts.
      const publicPageComponents =
        barType === "manual"
          ? pageComponents.map((c) =>
              c.monitor
                ? { ...c, monitor: { ...c.monitor, monitorIncidents: [] } }
                : c,
            )
          : pageComponents;

      return selectPublicPageSchemaWithRelation.parse({
        ..._page,
        customTheme,
        monitors: monitorsWithPrivateLocationCount,
        monitorGroups,
        trackers,
        incidents:
          monitorsWithPrivateLocationCount.flatMap((m) => m.monitorIncidents) ??
          [],
        statusReports,
        maintenances,
        workspacePlan: _page.workspace.plan,
        statusUpdateTypes: getStatusUpdateTypes({
          accessType: _page.accessType ?? "public",
          emailSubscriptionsEnabled:
            ws.data?.limits["status-subscribers"] ?? false,
        }),
        status,
        lastEvents,
        openEvents,
        pageComponents: publicPageComponents,
        pageComponentGroups: _page.pageComponentGroups,
        whiteLabel,
      });
    }),

  getLight: publicProcedure
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        pw: queryPasswordSchema,
      }),
    )
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await getPublicStatusPageLight({
        input: { slug: opts.input.slug },
        visitor: visitorFromCtx(opts.ctx, opts.input.pw),
      });
      if (!_page) return null;

      // Extract monitor components for backwards compatibility
      const monitorComponents = _page.pageComponents.filter(
        (c) =>
          c.type === "monitor" &&
          c.monitor &&
          c.monitor.active &&
          !c.monitor.deletedAt,
      );

      // Build legacy monitors array (sorted by order)
      const monitors = monitorComponents
        .map((c) => ({
          ...c.monitor,
          public: c.public,
          // the page component carries the public-facing name/description;
          // clear externalName so the schema transform keeps the override.
          // description: NULL means never backfilled → fall back to the
          // monitor's own; "" is a deliberately cleared field → stays blank.
          name: c.name,
          description: c.description ?? c.monitor?.description ?? "",
          externalName: null,
        }))
        .sort((a, b) => {
          const aComp = monitorComponents.find((m) => m.monitor?.id === a.id);
          const bComp = monitorComponents.find((m) => m.monitor?.id === b.id);
          return (aComp?.order ?? 0) - (bComp?.order ?? 0);
        });

      // Extract all incidents from monitor components
      const incidents = monitorComponents.flatMap(
        (c) => c.monitor?.monitorIncidents ?? [],
      );

      const ws = selectWorkspaceSchema.safeParse(_page.workspace);
      const whiteLabel = ws.data?.limits["white-label"] ?? false;
      // stored custom theme stops applying when the plan no longer includes it
      const customTheme = ws.data?.limits["custom-theme"]
        ? _page.customTheme
        : null;

      const statusReports = _page.statusReports.sort(
        sortStatusReportsByLatestUpdate,
      );

      return selectPublicPageLightSchemaWithRelation.parse({
        ..._page,
        customTheme,
        monitors,
        incidents,
        statusReports,
        maintenances: _page.maintenances,
        pageComponents: _page.pageComponents,
        pageComponentGroups: _page.pageComponentGroups,
        workspacePlan: _page.workspace.plan,
        whiteLabel,
      });
    }),

  // Narrow access-check query for the markdown detail routes: returns only the
  // gate + chrome fields, skipping the full reports/maintenances/components graph
  // that getLight loads.
  getGate: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase() }))
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      return getPublicStatusPageGate({ input: { slug: opts.input.slug } });
    }),

  getMaintenance: publicProcedure
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        id: z.number(),
        pw: queryPasswordSchema,
      }),
    )
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _maintenance = await callVisitorVerb(() =>
        getPublicMaintenance({
          input: { slug: opts.input.slug, id: opts.input.id },
          visitor: visitorFromCtx(opts.ctx, opts.input.pw),
        }),
      );
      if (!_maintenance) return null;

      const props: z.infer<typeof selectMaintenancePageSchema> = _maintenance;
      return selectMaintenancePageSchema.parse(props);
    }),

  getUptime: publicProcedure
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        pw: queryPasswordSchema,
        pageComponentIds: z.string().array(),
        cardType: cardTypeSchema.prefault("requests"),
        barType: z
          .enum(["absolute", "dominant", "manual"])
          .prefault("dominant"),
        // preview override for the floating-button config; falls back to the
        // page's stored `configuration.days` when omitted
        days: z.union([z.literal(30), z.literal(45)]).optional(),
      }),
    )
    .query(async (opts) => {
      const input = opts.input;
      if (!input.slug) return null;

      const result = await callVisitorVerb(() =>
        getPublicStatusPageUptime({
          input: {
            slug: input.slug,
            pageComponentIds: input.pageComponentIds
              .map(Number)
              .filter(Number.isFinite),
          },
          visitor: visitorFromCtx(opts.ctx, input.pw),
        }),
      );
      if (!result) return null;
      const { page: _page, privateLocationCounts } = result;

      const pageComponents = parsePageComponents(_page.pageComponents);

      // Early return if no components to process
      if (pageComponents.length === 0) return [];

      const monitors = pageComponents.filter(isMonitorComponent);

      // a zone this runtime cannot resolve renders the page in UTC instead of failing it
      const pageTimeZone = timeZoneSchema
        .catch("UTC")
        .parse(_page.defaultTimezone);

      // Manual mode never touches Tinybird. Otherwise race the reads against
      // the fallback budget: a slow (>5s) or erroring Tinybird degrades the
      // whole page to manual mode so bars still render from DB events.
      const tinybird = await withTinybirdFallback(() =>
        input.barType === "manual"
          ? Promise.resolve(null)
          : fetchStatusDays(monitors, pageTimeZone, input.cardType),
      );

      const tinybirdUnhealthy = !tinybird.ok;
      const timeZone = tinybird.data?.timeZone ?? pageTimeZone;
      const statusDataByMonitorId =
        tinybird.data?.rows ?? new Map<string, never[]>();

      const parsedConfiguration = pageConfigurationSchema.safeParse(
        _page.configuration ?? {},
      );
      const lookbackPeriod =
        input.days ??
        (parsedConfiguration.success ? parsedConfiguration.data.days : 45);

      // No public regions alone doesn't make a monitor private-only: it may
      // have no locations at all, so confirm an active private assignment.
      const privateOnlyMonitorIds = new Set(
        monitors
          .filter(
            (c) =>
              c.monitor.regions.length === 0 &&
              privateLocationCounts.has(c.monitor.id),
          )
          .map((c) => c.monitor.id),
      );

      return pageComponents.map((c) => {
        const events = getEvents({
          maintenances: _page.maintenances,
          incidents: c.monitor?.monitorIncidents ?? [],
          reports: _page.statusReports,
          pageComponentId: c.id,
          monitorId: c.monitorId ?? undefined,
          componentType: c.type,
        });

        // Determine whether to use real Tinybird data or synthetic data
        const shouldUseRealData =
          c.type === "monitor" &&
          c.monitor &&
          input.barType !== "manual" &&
          !tinybirdUnhealthy &&
          process.env.NOOP_UPTIME !== "true";

        let filledData: StatusData[];
        if (shouldUseRealData) {
          // Monitor components with real data: use Tinybird data
          const monitorId = c.monitor?.id.toString() || "";
          const rawData = statusDataByMonitorId.get(monitorId) || [];
          filledData = fillStatusDataFor45Days(
            rawData,
            monitorId,
            lookbackPeriod,
            timeZone,
          );
        } else {
          // Static components, manual mode, or NOOP mode: use synthetic data
          filledData = fillStatusDataFor45DaysNoop({
            errorDays: [],
            degradedDays: [],
            lookbackPeriod,
            timeZone,
          });
        }

        // Static components have no monitoring data; a degraded Tinybird forces
        // every component into manual mode so bars/cards still render.
        const forceManual = c.type === "static" || tinybirdUnhealthy;
        const effectiveBarType = forceManual ? "manual" : input.barType;
        // heartbeat and private-only monitors have no runs: they keep counting requests
        const effectiveCardType = forceManual
          ? "manual"
          : input.cardType === "runs" && !(c.monitor && countsRuns(c.monitor))
            ? "requests"
            : input.cardType;

        const processedData = setDataByType({
          events,
          data: filledData,
          cardType: effectiveCardType,
          barType: effectiveBarType,
          timeZone,
        });
        const uptime = getUptime({
          data: filledData,
          events,
          barType: effectiveBarType,
          cardType: effectiveCardType,
          timeZone,
          privateLocationOnly:
            c.monitor != null && privateOnlyMonitorIds.has(c.monitor.id),
          heartbeat: c.monitor?.jobType === "heartbeat",
        });

        return {
          id: c.id,
          pageComponentId: c.id,
          name: c.name,
          description: c.description,
          type: c.type,
          public: c.public,
          // For monitor-type components, include monitor fields
          ...(c.monitor ? { monitor: c.monitor } : {}),
          data: processedData,
          uptime,
          // the zone the days were grouped in, UTC if the page's was rejected
          timeZone,
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
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        id: z.number(),
        pw: queryPasswordSchema,
      }),
    )
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _report = await callVisitorVerb(() =>
        getPublicStatusReport({
          input: { slug: opts.input.slug, id: opts.input.id },
          visitor: visitorFromCtx(opts.ctx, opts.input.pw),
        }),
      );
      if (!_report) return null;

      const result: z.infer<typeof selectStatusReportPageSchema> = _report;
      return selectStatusReportPageSchema.parse(result);
    }),

  getMonitors: publicProcedure
    .input(
      z.object({ slug: z.string().toLowerCase(), pw: queryPasswordSchema }),
    )
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const components = await callVisitorVerb(() =>
        listPublicStatusPageMonitors({
          input: { slug: opts.input.slug },
          visitor: visitorFromCtx(opts.ctx, opts.input.pw),
        }),
      );
      if (!components) return null;

      const pageComponents = parsePageComponents(components);

      const publicMonitors = pageComponents
        .filter(isMonitorComponent)
        .filter((c) => c.public);

      // Slow/erroring Tinybird → empty latency data so the page still renders.
      const metrics = await withTinybirdFallback(() =>
        fetchByJobType(publicMonitors, (type) =>
          type === "heartbeat"
            ? null
            : cachedPipe(
                `latency1dMulti:${type}`,
                getMetricsLatencyMultiProcedure("1d", type),
                PUBLIC_STATUS_TTL,
              ),
        ),
      );
      const metricsDataByMonitorId = metrics.data ?? new Map<string, never[]>();

      return publicMonitors.map((c) => {
        const monitorId = c.monitor.id.toString();
        const data = metricsDataByMonitorId.get(monitorId) || [];

        return {
          ...selectPublicMonitorSchema.parse(c.monitor),
          data,
        };
      });
    }),

  getMonitor: publicProcedure
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        id: z.number(),
        pw: queryPasswordSchema,
      }),
    )
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const components = await callVisitorVerb(() =>
        getPublicStatusPageMonitor({
          input: { slug: opts.input.slug, id: opts.input.id },
          visitor: visitorFromCtx(opts.ctx, opts.input.pw),
        }),
      );
      if (!components) return null;

      const pageComponents = parsePageComponents(components);

      const monitorComponents = pageComponents.filter(isMonitorComponent);

      const component = monitorComponents.find(
        (c) => c.monitor.id === opts.input.id,
      );
      const _monitor = component?.monitor;

      if (!component || !_monitor) return null;
      if (!component.public) return null;
      if (_monitor.deletedAt) return null;

      const proceduresByType = {
        http: monitorMetricsProcedures("http"),
        tcp: monitorMetricsProcedures("tcp"),
        dns: monitorMetricsProcedures("dns"),
        icmp: monitorMetricsProcedures("icmp"),
        grpc: monitorMetricsProcedures("grpc"),
      };

      // `udp` and `ssl` are monitor job types with no Tinybird pipes. Looking the
      // key up instead of asserting the type means such a monitor renders with
      // empty charts — the same shape a Tinybird outage produces — rather than
      // throwing on a missing key.
      const procedures =
        proceduresByType[_monitor.jobType as keyof typeof proceduresByType] ??
        null;

      const fromDate = startOfDay(subDays(new Date(), 7)).toISOString();
      const toDate = endOfDay(new Date()).toISOString();

      // Slow/erroring Tinybird → empty chart data so the page still renders.
      const metrics = !procedures
        ? { ok: false as const, data: null }
        : await withTinybirdFallback(() =>
            Promise.all([
              procedures.latency({
                monitorId: _monitor.id.toString(),
                fromDate,
                toDate,
              }),
              procedures.regions({
                monitorId: _monitor.id.toString(),
                fromDate,
                toDate,
              }),
              procedures.uptime({
                monitorId: _monitor.id.toString(),
                interval: 240,
                fromDate,
                toDate,
              }),
            ]),
          );

      const [latency, regions, uptime] = metrics.data ?? [
        { data: [] },
        { data: [] },
        { data: [] },
      ];

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
    .meta({ track: Events.SubscribePage, trackProps: ["slug"] })
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        email: z.email(),
        subscribeComponents: z.boolean(),
        pageComponents: z.array(z.number().int().positive()),
      }),
    )
    .mutation(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await callVisitorVerb(() =>
        getPublicSubscriptionPage({
          input: { slug: opts.input.slug },
          visitor: visitorFromCtx(opts.ctx),
        }),
      );

      if (!_page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      // Guard against email spam: reject if a pending (unverified, unexpired) subscription exists
      const isPending = await callVisitorVerb(() =>
        hasPendingSubscriber({
          input: { email: opts.input.email, pageId: _page.id },
          // gated by `getPublicSubscriptionPage` above
          visitor: null,
        }),
      );
      if (isPending) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "A confirmation link was already sent. Please check your email or wait until it expires to request a new one.",
        });
      }

      const subscription = await callVisitorVerb(() =>
        upsertSelfSignupSubscriber({
          input: {
            email: opts.input.email,
            pageId: _page.id,
            componentIds: opts.input.subscribeComponents
              ? opts.input.pageComponents
              : [],
          },
          visitor: visitorFromCtx(opts.ctx),
        }),
      );

      // Already verified — no need to send another verification email
      if (subscription.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email already subscribed",
        });
      }

      await callVisitorVerb(() =>
        sendSubscriberVerification({ subscriber: subscription }),
      );

      return { id: subscription.id };
    }),

  getSubscriptionByToken: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase(), token: z.uuid() }))
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const subscription = await getSubscriberByToken({
        input: { token: opts.input.token, domain: opts.input.slug },
      });

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      return subscription;
    }),

  updateSubscription: publicProcedure
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        token: z.uuid(),
        subscribeComponents: z.boolean(),
        pageComponents: z.array(z.number().int().positive()),
      }),
    )
    .mutation(async (opts) => {
      if (!opts.input.slug) return null;

      try {
        await updateSubscriberScope({
          input: {
            token: opts.input.token,
            componentIds: opts.input.subscribeComponents
              ? opts.input.pageComponents
              : [],
            domain: opts.input.slug,
          },
        });
      } catch (error) {
        if (error instanceof Error) {
          const code = error.message.toLowerCase().includes("not found")
            ? "NOT_FOUND"
            : "BAD_REQUEST";
          throw new TRPCError({ code, message: error.message });
        }
        throw error;
      }

      return { success: true };
    }),

  validateEmailDomain: publicProcedure
    .meta({ track: Events.ValidateEmailDomain, trackProps: ["slug"] })
    .input(z.object({ slug: z.string().toLowerCase(), email: z.string() }))
    .query(async (opts) => {
      if (!opts.input.slug) return null;

      const _page = await callVisitorVerb(() =>
        checkPublicEmailDomain({
          input: { slug: opts.input.slug, email: opts.input.email },
        }),
      );

      if (!_page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      return {
        email: opts.input.email,
        slug: opts.input.slug,
        page: { title: _page.title },
      };
    }),

  verifyEmail: publicProcedure
    .meta({ track: Events.VerifySubscribePage, trackProps: ["slug"] })
    .input(z.object({ slug: z.string().toLowerCase(), token: z.uuid() }))
    .mutation(async (opts) => {
      if (!opts.input.slug) return null;

      try {
        const subscription = await verifySelfSignupSubscriber({
          input: { token: opts.input.token, domain: opts.input.slug },
        });

        if (!subscription) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Subscription not found",
          });
        }

        return subscription;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),

  verifyPassword: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase(), password: z.string() }))
    .mutation(async (opts) => {
      if (!opts.input.slug) return null;

      const limiter = pagePasswordRateLimit();
      const attempt = {
        slug: opts.input.slug,
        ip: visitorFromCtx(opts.ctx).clientIp ?? null,
      };
      const tooMany = () =>
        new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many password attempts. Try again later.",
        });

      const verified = await callVisitorVerb(async () => {
        try {
          return await verifyPublicStatusPagePassword({
            input: { slug: opts.input.slug, password: opts.input.password },
          });
        } catch (err) {
          if (err instanceof InvalidPagePasswordError) {
            const { locked } = await limiter.recordFailure(
              attempt,
              opts.input.password,
            );
            if (locked) throw tooMany();
          }
          throw err;
        }
      });
      if (verified && (await limiter.isLocked(attempt))) throw tooMany();

      if (!verified) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      return true;
    }),

  // Server-side password gate for the public `/api/*` routes. Returns a boolean
  // so the stored password never leaves the server (the `get` output omits it).
  isPasswordAuthorized: publicProcedure
    .input(
      z.object({
        slug: z.string().toLowerCase(),
        queryPassword: z.string().nullish(),
        cookiePassword: z.string().nullish(),
      }),
    )
    .query(async (opts) => {
      const submitted = opts.input.queryPassword ?? opts.input.cookiePassword;
      // Nothing (or "") submitted can never authorize, so it is not a guess:
      // anonymous feed reads must not count. Shares the login form's budget; a
      // stale feed cookie counts once, as one distinct value.
      if (!submitted) {
        return (
          (await isPublicStatusPagePasswordAuthorized({ input: opts.input })) ??
          false
        );
      }

      const limiter = pagePasswordRateLimit();
      const attempt = {
        slug: opts.input.slug,
        ip: visitorFromCtx(opts.ctx).clientIp ?? null,
      };
      const authorized = await isPublicStatusPagePasswordAuthorized({
        input: opts.input,
      });
      // null: no password-gated page matched, so nothing to count.
      if (authorized === false) {
        await limiter.recordFailure(attempt, submitted);
        return false;
      }
      if (authorized && (await limiter.isLocked(attempt))) return false;
      return authorized ?? false;
    }),

  getSubscriberByToken: publicProcedure
    .input(z.object({ token: z.uuid(), domain: z.string().toLowerCase() }))
    .query(async (opts) => {
      const subscription = await getSubscriberByToken({
        input: { token: opts.input.token, domain: opts.input.domain },
      });

      if (
        !subscription ||
        subscription.unsubscribedAt ||
        subscription.channelType !== "email"
      ) {
        return null;
      }

      return {
        pageName: subscription.pageName,
        maskedEmail: subscription.email,
      };
    }),

  unsubscribe: publicProcedure
    .input(z.object({ token: z.uuid(), domain: z.string().toLowerCase() }))
    .mutation(async (opts) => {
      try {
        await unsubscribeSubscriber({
          input: { token: opts.input.token, domain: opts.input.domain },
        });
        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),
});
