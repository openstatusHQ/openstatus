import {
  getExternalServiceBySlug,
  listExternalServices,
} from "@openstatus/services/external-service";
import {
  getExternalComponentBySlug,
  listExternalComponentsBySlug,
} from "@openstatus/services/external-service-component";
import {
  type ExternalIncidentListItem,
  listExternalIncidentsByComponent,
  listExternalIncidentsByServiceId,
  listExternalIncidentsBySlug,
} from "@openstatus/services/external-service-incident";
import {
  getComponentReportWindows,
  getServiceReportCountries,
  getServiceReportDaily,
  getServiceReportWindows,
  recordExternalServiceReport,
} from "@openstatus/services/external-service-report";
import { OSTinybird } from "@openstatus/tinybird";
import { redis } from "@openstatus/upstash";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "../env";
import { toTRPCError } from "../service-adapter";
import { createTRPCRouter, publicProcedure } from "../trpc";
import {
  REPORT_THRESHOLD,
  REPORT_WINDOW_MS,
  computeEffectiveStatus,
} from "./effective-status";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

const DEFAULT_HISTORY_DAYS = 45;
const INCIDENTS_LIMIT = 5;
const REPORT_COUNTRIES_LIMIT = 5;
const REPORT_COOLDOWN_SECONDS = REPORT_WINDOW_MS / 1000;
const REPORT_RATELIMIT_TIMEOUT_MS = 1000;

function getClientIp(headers: Headers | undefined): string {
  if (!headers) return "";
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "";
}

async function hashReporter(ip: string): Promise<string> {
  const salt = env.EXTERNAL_REPORT_SALT ?? "";
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function reportAlreadyLimited(key: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = (async () => {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, REPORT_COOLDOWN_SECONDS);
    return count > 1;
  })();
  work.catch(() => {});
  try {
    return await Promise.race([
      work,
      new Promise<boolean>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("redis timeout")),
          REPORT_RATELIMIT_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (err) {
    console.warn(
      `[external-service report] rate-limit skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Logging here uses `console.*`, not `@logtape/logtape`: this router runs on the
// Next.js Edge runtime and `@openstatus/api` (like the edge-safe `services`
// package) deliberately takes no logtape dependency. The logtape-based logger is
// for Node contexts such as the `apps/workflows` cron. Matches every sibling router.
async function safeRows<T>(promise: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await promise;
  } catch (err) {
    console.error(`[external-service] ${label} failed, returning empty:`, err);
    return [];
  }
}

async function safeData<T>(
  promise: Promise<{ data: T[] }>,
  label: string,
): Promise<T[]> {
  try {
    const { data } = await promise;
    return data;
  } catch (err) {
    console.error(`[external-service] ${label} failed, returning empty:`, err);
    return [];
  }
}

const gridItemSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  url: z.string(),
  aliases: z.array(z.string()),
  indicator: z.string(),
  status: z.string(),
  statusMessage: z.string(),
  escalated: z.boolean(),
  reporters: z.number(),
});

const effectiveSchema = z.object({
  indicator: z.string(),
  status: z.string(),
  escalated: z.boolean(),
});

const reportsSummarySchema = z.object({
  window: z.object({
    reporters: z.number(),
    countries: z.number(),
    total: z.number(),
  }),
  threshold: z.number(),
  daily: z.array(
    z.object({
      day: z.string(),
      reporters: z.number(),
      total: z.number(),
    }),
  ),
  topCountries: z.array(z.object({ country: z.string(), total: z.number() })),
});

const detailServiceSchema = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string(),
  statusPageUrl: z.string(),
  aliases: z.array(z.string()),
  apiConfigType: z.string().optional(),
});

const latestSchema = z.object({
  indicator: z.string(),
  status: z.string(),
  statusMessage: z.string(),
  timeZone: z.string(),
  lastFetchedAt: z.number(),
});

const historyRowSchema = z.object({
  day: z.string(),
  worstIndicator: z.string(),
  hadMaintenance: z.number(),
  snapshotCount: z.number(),
});

const incidentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  impact: z.string().optional(),
  shortlink: z.string().optional(),
  startedAt: z.string().optional(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable().optional(),
});

const componentItemSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  groupName: z.string().nullable(),
  position: z.number(),
  indicator: z.string(),
  status: z.string(),
  history: z.array(historyRowSchema),
  incidents: z.array(incidentSchema),
});

const componentDetailSchema = z.object({
  found: z.boolean(),
  service: z
    .object({ slug: z.string(), name: z.string(), statusPageUrl: z.string() })
    .nullable(),
  component: z
    .object({
      id: z.number(),
      slug: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      groupName: z.string().nullable(),
      indicator: z.string(),
      status: z.string(),
      lastFetchedAt: z.number(),
      stale: z.boolean(),
      escalated: z.boolean(),
      reporters: z.number(),
    })
    .nullable(),
  history: z.array(historyRowSchema),
  incidents: z.array(incidentSchema),
  overlayIncidents: z.array(incidentSchema),
});

type HistoryTbRow = {
  day: string;
  worst_indicator: string;
  had_maintenance: number;
  snapshot_count: number;
};

function toHistoryRow(r: HistoryTbRow) {
  return {
    day: r.day,
    worstIndicator: r.worst_indicator,
    hadMaintenance: r.had_maintenance,
    snapshotCount: r.snapshot_count,
  };
}

function toIncidentDTO(i: ExternalIncidentListItem) {
  return {
    id: i.providerIncidentId,
    name: i.name,
    status: i.status,
    impact: i.impact ?? undefined,
    shortlink: i.shortlink ?? undefined,
    startedAt: i.startedAt?.toISOString(),
    createdAt: i.createdAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
  };
}

// Window for overlaying incidents onto the bars: the visible `days` plus a
// one-day pad so an incident starting just before the first bar still buckets.
function overlaySince(days: number): Date {
  return new Date(Date.now() - (days + 1) * 24 * 60 * 60 * 1000);
}

// An untagged incident (empty affected_component_ids) is service-wide, so it
// applies to every component; otherwise it must name this upstream component.
function incidentAffectsComponent(
  i: ExternalIncidentListItem,
  upstreamComponentId: string,
): boolean {
  return (
    i.affectedComponentIds.length === 0 ||
    i.affectedComponentIds.includes(upstreamComponentId)
  );
}

export const externalServiceRouter = createTRPCRouter({
  grid: publicProcedure.output(z.array(gridItemSchema)).query(async () => {
    const [services, latestRows] = await Promise.all([
      listExternalServices({}),
      safeData(tb.externalStatusLatest({}), "externalStatusLatest (grid)"),
    ]);

    const reportRows = await safeRows(
      getServiceReportWindows({
        serviceIds: services.map((s) => s.id),
        since: new Date(Date.now() - REPORT_WINDOW_MS),
      }),
      "getServiceReportWindows (grid)",
    );

    const byId = new Map<string, (typeof latestRows)[number]>();
    for (const row of latestRows) byId.set(row.id, row);
    const reportersByServiceId = new Map<number, number>();
    for (const row of reportRows) {
      reportersByServiceId.set(row.externalServiceId, row.reporters);
    }

    return services.map((s) => {
      const snap = byId.get(s.slug);
      const reporters = reportersByServiceId.get(s.id) ?? 0;
      const effective = computeEffectiveStatus({
        providerIndicator: snap?.indicator ?? "",
        providerStatus: snap?.status ?? "",
        reporters,
        threshold: REPORT_THRESHOLD,
      });
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        url: s.url,
        aliases: Array.isArray(s.aliases) ? s.aliases : [],
        indicator: effective.indicator,
        status: effective.status,
        statusMessage: snap?.status_message ?? "Status unavailable",
        escalated: effective.escalated,
        reporters,
      };
    });
  }),

  detail: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        days: z.number().int().min(1).max(90).optional(),
      }),
    )
    .output(
      z.object({
        service: detailServiceSchema,
        latest: latestSchema.nullable(),
        history: z.array(historyRowSchema),
        effective: effectiveSchema,
        reports: z.object({ reporters: z.number(), threshold: z.number() }),
        overlayIncidents: z.array(incidentSchema),
      }),
    )
    .query(async ({ input }) => {
      const service = await getExternalServiceBySlug({ slug: input.slug });
      if (!service) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "External service not found",
        });
      }

      const aliasSlugs = Array.isArray(service.aliases) ? service.aliases : [];
      const slugChain = [service.slug, ...aliasSlugs];
      const days = input.days ?? DEFAULT_HISTORY_DAYS;
      const since = new Date(Date.now() - REPORT_WINDOW_MS);

      const [latestRows, historyRows, reportRows, overlayIncidentRows] =
        await Promise.all([
          safeData(
            tb.externalStatusLatest({ ids: slugChain }),
            "externalStatusLatest",
          ),
          safeData(
            tb.externalStatusHistory({ ids: slugChain, days }),
            "externalStatusHistory",
          ),
          safeRows(
            getServiceReportWindows({ serviceIds: [service.id], since }),
            "getServiceReportWindows (detail)",
          ),
          safeRows(
            listExternalIncidentsByServiceId({
              externalServiceId: service.id,
              since: overlaySince(days),
            }),
            "listExternalIncidentsByServiceId (detail)",
          ),
        ]);

      const newest = [...latestRows].sort(
        (a, b) => b.last_fetched_at - a.last_fetched_at,
      )[0];

      const latest = newest
        ? {
            indicator: newest.indicator,
            status: newest.status,
            statusMessage: newest.status_message,
            timeZone: newest.time_zone,
            lastFetchedAt: newest.last_fetched_at,
          }
        : null;

      const reporters = reportRows[0]?.reporters ?? 0;
      const threshold = REPORT_THRESHOLD;
      const effective = computeEffectiveStatus({
        providerIndicator: latest?.indicator ?? "",
        providerStatus: latest?.status ?? "",
        reporters,
        threshold,
      });

      return {
        service: {
          slug: service.slug,
          name: service.name,
          url: service.url,
          statusPageUrl: service.statusPageUrl,
          aliases: aliasSlugs,
          apiConfigType: service.apiConfig?.type,
        },
        latest,
        history: historyRows.map(toHistoryRow),
        effective,
        reports: { reporters, threshold },
        overlayIncidents: overlayIncidentRows.map(toIncidentDTO),
      };
    }),

  incidents: publicProcedure
    .input(z.object({ slug: z.string() }))
    .output(
      z.object({
        supported: z.boolean(),
        incidents: z.array(incidentSchema),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { supported, incidents } = await listExternalIncidentsBySlug({
          slug: input.slug,
          limit: INCIDENTS_LIMIT,
        });
        if (!supported) {
          return { supported: false, incidents: [] };
        }
        return {
          supported: true,
          incidents: incidents.map(toIncidentDTO),
        };
      } catch (err) {
        // matches the graceful-degrade pattern used by `grid` / `detail`:
        // a DB hiccup on a public page shouldn't 500, it should fall back to
        // the upstream-link UI via supported=false.
        console.warn(
          `[external-service incidents] DB read failed for slug=${input.slug}:`,
          err,
        );
        return { supported: false, incidents: [] };
      }
    }),

  components: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        days: z.number().int().min(1).max(90).optional(),
      }),
    )
    .output(
      z.object({
        supported: z.boolean(),
        components: z.array(componentItemSchema),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { supported, components, service } =
          await listExternalComponentsBySlug({ slug: input.slug });
        if (!supported || !service || components.length === 0) {
          return { supported, components: [] };
        }

        const days = input.days ?? DEFAULT_HISTORY_DAYS;
        const componentIds = components.map((c) => String(c.id));
        const [historyRows, serviceIncidents] = await Promise.all([
          safeData(
            tb.externalStatusComponentHistory({
              component_ids: componentIds,
              days,
            }),
            "externalStatusComponentHistory",
          ),
          safeRows(
            listExternalIncidentsByServiceId({
              externalServiceId: service.id,
              since: overlaySince(days),
            }),
            "listExternalIncidentsByServiceId (components)",
          ),
        ]);

        const historyByComponent = new Map<string, typeof historyRows>();
        for (const row of historyRows) {
          const list = historyByComponent.get(row.component_id);
          if (list) list.push(row);
          else historyByComponent.set(row.component_id, [row]);
        }

        return {
          supported: true,
          components: components.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            description: c.description,
            groupName: c.groupName,
            position: c.position,
            indicator: c.indicator,
            status: c.status,
            history: (historyByComponent.get(String(c.id)) ?? []).map(
              toHistoryRow,
            ),
            incidents: serviceIncidents
              .filter((inc) =>
                incidentAffectsComponent(inc, c.upstreamComponentId),
              )
              .map(toIncidentDTO),
          })),
        };
      } catch (err) {
        console.warn(
          `[external-service components] read failed for slug=${input.slug}:`,
          err,
        );
        return { supported: false, components: [] };
      }
    }),

  component: publicProcedure
    .input(
      z.object({
        serviceSlug: z.string(),
        componentSlug: z.string(),
        days: z.number().int().min(1).max(90).optional(),
      }),
    )
    .output(componentDetailSchema)
    .query(async ({ input }) => {
      const empty = {
        found: false as const,
        service: null,
        component: null,
        history: [],
        incidents: [],
        overlayIncidents: [],
      };
      try {
        const { service, component } = await getExternalComponentBySlug({
          serviceSlug: input.serviceSlug,
          componentSlug: input.componentSlug,
        });
        if (!service || !component) return empty;

        const days = input.days ?? DEFAULT_HISTORY_DAYS;
        const since = new Date(Date.now() - REPORT_WINDOW_MS);
        const [historyRows, incidents, reportRows, overlayServiceIncidents] =
          await Promise.all([
            safeData(
              tb.externalStatusComponentHistory({
                component_ids: [String(component.id)],
                days,
              }),
              "externalStatusComponentHistory (component)",
            ),
            listExternalIncidentsByComponent({
              externalServiceId: service.id,
              upstreamComponentId: component.upstreamComponentId,
              limit: INCIDENTS_LIMIT,
            }),
            safeRows(
              getComponentReportWindows({ serviceId: service.id, since }),
              "getComponentReportWindows (component)",
            ),
            safeRows(
              listExternalIncidentsByServiceId({
                externalServiceId: service.id,
                since: overlaySince(days),
              }),
              "listExternalIncidentsByServiceId (component)",
            ),
          ]);

        const reporters =
          reportRows.find((r) => r.componentId === component.id)?.reporters ??
          0;
        const effective = computeEffectiveStatus({
          providerIndicator: component.indicator,
          providerStatus: component.status,
          reporters,
          threshold: REPORT_THRESHOLD,
        });

        return {
          found: true,
          service: {
            slug: service.slug,
            name: service.name,
            statusPageUrl: service.statusPageUrl,
          },
          component: {
            id: component.id,
            slug: component.slug,
            name: component.name,
            description: component.description,
            groupName: component.groupName,
            indicator: effective.indicator,
            status: effective.status,
            lastFetchedAt: component.lastFetchedAt ?? 0,
            stale: component.stale,
            escalated: effective.escalated,
            reporters,
          },
          history: historyRows.map(toHistoryRow),
          incidents: incidents.map(toIncidentDTO),
          overlayIncidents: overlayServiceIncidents
            .filter((inc) =>
              incidentAffectsComponent(inc, component.upstreamComponentId),
            )
            .map(toIncidentDTO),
        };
      } catch (err) {
        console.warn(
          `[external-service component] read failed for ${input.serviceSlug}/${input.componentSlug}:`,
          err,
        );
        return empty;
      }
    }),

  report: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        componentSlug: z.string().nullish(),
      }),
    )
    .output(z.object({ ok: z.boolean(), alreadyReported: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req?.headers);
      if (!ip) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not determine the reporter's origin",
        });
      }

      const reporterHash = await hashReporter(ip);
      const limited = await reportAlreadyLimited(
        `extreport:${input.slug}:${reporterHash}`,
      );
      if (limited) {
        return { ok: true, alreadyReported: true };
      }

      try {
        await recordExternalServiceReport({
          input: {
            slug: input.slug,
            componentSlug: input.componentSlug ?? undefined,
            reporterHash,
            country: ctx.req?.headers.get("x-vercel-ip-country") ?? "",
          },
        });
      } catch (err) {
        toTRPCError(err);
      }

      return { ok: true, alreadyReported: false };
    }),

  reports: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        days: z.number().int().min(1).max(90).optional(),
      }),
    )
    .output(reportsSummarySchema)
    .query(async ({ input }) => {
      const service = await getExternalServiceBySlug({ slug: input.slug });
      if (!service) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "External service not found",
        });
      }

      const days = input.days ?? DEFAULT_HISTORY_DAYS;
      const since = new Date(Date.now() - REPORT_WINDOW_MS);
      const dailySince = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const threshold = REPORT_THRESHOLD;

      const [windowRows, dailyRows, countryRows] = await Promise.all([
        safeRows(
          getServiceReportWindows({ serviceIds: [service.id], since }),
          "getServiceReportWindows (reports)",
        ),
        safeRows(
          getServiceReportDaily({ serviceId: service.id, since: dailySince }),
          "getServiceReportDaily",
        ),
        safeRows(
          getServiceReportCountries({
            serviceId: service.id,
            since,
            limit: REPORT_COUNTRIES_LIMIT,
          }),
          "getServiceReportCountries",
        ),
      ]);

      const win = windowRows[0];
      return {
        window: {
          reporters: win?.reporters ?? 0,
          countries: win?.countries ?? 0,
          total: win?.total ?? 0,
        },
        threshold,
        daily: dailyRows.map((r) => ({
          day: r.day,
          reporters: r.reporters,
          total: r.total,
        })),
        topCountries: countryRows.map((r) => ({
          country: r.country,
          total: r.total,
        })),
      };
    }),
});
