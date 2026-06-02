import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
  listExternalIncidentsBySlug,
} from "@openstatus/services/external-service-incident";
import { OSTinybird } from "@openstatus/tinybird";

import { env } from "../env";
import { createTRPCRouter, publicProcedure } from "../trpc";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

const DEFAULT_HISTORY_DAYS = 45;
const INCIDENTS_LIMIT = 5;

// Logging here uses `console.*`, not `@logtape/logtape`: this router runs on the
// Next.js Edge runtime and `@openstatus/api` (like the edge-safe `services`
// package) deliberately takes no logtape dependency. The logtape-based logger is
// for Node contexts such as the `apps/workflows` cron. Matches every sibling router.
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
  slug: z.string(),
  name: z.string(),
  url: z.string(),
  aliases: z.array(z.string()),
  indicator: z.string(),
  status: z.string(),
  statusMessage: z.string(),
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
      lastSeenAt: z.number(),
      stale: z.boolean(),
    })
    .nullable(),
  history: z.array(historyRowSchema),
  incidents: z.array(incidentSchema),
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

export const externalServiceRouter = createTRPCRouter({
  grid: publicProcedure.output(z.array(gridItemSchema)).query(async () => {
    const [services, latestRows] = await Promise.all([
      listExternalServices({}),
      safeData(tb.externalStatusLatest({}), "externalStatusLatest (grid)"),
    ]);

    const byId = new Map<string, (typeof latestRows)[number]>();
    for (const row of latestRows) byId.set(row.id, row);

    return services.map((s) => {
      const snap = byId.get(s.slug);
      return {
        slug: s.slug,
        name: s.name,
        url: s.url,
        aliases: Array.isArray(s.aliases) ? s.aliases : [],
        indicator: snap?.indicator ?? "",
        status: snap?.status ?? "",
        statusMessage: snap?.status_message ?? "Status unavailable",
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

      const [latestRows, historyRows] = await Promise.all([
        safeData(
          tb.externalStatusLatest({ ids: slugChain }),
          "externalStatusLatest",
        ),
        safeData(
          tb.externalStatusHistory({ ids: slugChain, days }),
          "externalStatusHistory",
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
        const { supported, components } = await listExternalComponentsBySlug({
          slug: input.slug,
        });
        if (!supported || components.length === 0) {
          return { supported, components: [] };
        }

        const days = input.days ?? DEFAULT_HISTORY_DAYS;
        const componentIds = components.map((c) => String(c.id));
        const historyRows = await safeData(
          tb.externalStatusComponentHistory({
            component_ids: componentIds,
            days,
          }),
          "externalStatusComponentHistory",
        );

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
      };
      try {
        const { service, component } = await getExternalComponentBySlug({
          serviceSlug: input.serviceSlug,
          componentSlug: input.componentSlug,
        });
        if (!service || !component) return empty;

        const days = input.days ?? DEFAULT_HISTORY_DAYS;
        const [historyRows, incidents] = await Promise.all([
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
        ]);

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
            indicator: component.indicator,
            status: component.status,
            lastSeenAt: component.lastSeenAt.getTime(),
            stale: component.stale,
          },
          history: historyRows.map(toHistoryRow),
          incidents: incidents.map(toIncidentDTO),
        };
      } catch (err) {
        console.warn(
          `[external-service component] read failed for ${input.serviceSlug}/${input.componentSlug}:`,
          err,
        );
        return empty;
      }
    }),
});
