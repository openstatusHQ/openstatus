import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getExternalServiceBySlug,
  listExternalServices,
} from "@openstatus/services/external-service";
import { OSTinybird } from "@openstatus/tinybird";

import { env } from "../env";
import { createTRPCRouter, publicProcedure } from "../trpc";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

const DEFAULT_HISTORY_DAYS = 45;
const INCIDENTS_TIMEOUT_MS = 5000;
const MAX_INCIDENTS = 5;

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
  indicator: z.string(),
  status: z.string(),
  statusMessage: z.string(),
  lastFetchedAt: z.number(),
});

const detailServiceSchema = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string(),
  statusPageUrl: z.string(),
  aliases: z.array(z.string()),
  apiConfigType: z.string().optional(),
  deletedAt: z.date().nullable(),
});

const latestSchema = z.object({
  indicator: z.string(),
  status: z.string(),
  statusMessage: z.string(),
  timeZone: z.string(),
  lastFetchedAt: z.number(),
});

// snake_case kept so the output feeds the shared HistoryBars block unchanged.
const historyRowSchema = z.object({
  day: z.string(),
  worst_indicator: z.string(),
  had_maintenance: z.number(),
  snapshot_count: z.number(),
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

const atlassianIncidentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  impact: z.string().optional(),
  shortlink: z.string().optional(),
  started_at: z.string().optional(),
  created_at: z.string(),
  resolved_at: z.string().nullable().optional(),
});

const atlassianIncidentsResponseSchema = z.object({
  incidents: z.array(atlassianIncidentSchema),
});

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
        indicator: snap?.indicator ?? "",
        status: snap?.status ?? "",
        statusMessage: snap?.status_message ?? "Status unavailable",
        lastFetchedAt: snap?.last_fetched_at ?? 0,
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
          deletedAt: service.deletedAt,
        },
        latest,
        history: historyRows.map((r) => ({
          day: r.day,
          worst_indicator: r.worst_indicator,
          had_maintenance: r.had_maintenance,
          snapshot_count: r.snapshot_count,
        })),
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
      const service = await getExternalServiceBySlug({ slug: input.slug });
      if (!service || service.apiConfig?.type !== "atlassian") {
        return { supported: false, incidents: [] };
      }

      const url = `${service.statusPageUrl}/api/v2/incidents.json`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), INCIDENTS_TIMEOUT_MS);
      try {
        // packages/api carries no Next types; widen the init so the Next data
        // cache hint survives without an `as` cast.
        const init: RequestInit & { next?: { revalidate?: number } } = {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          next: { revalidate: 60 },
        };
        const res = await fetch(url, init);
        if (!res.ok) {
          console.warn(
            `[external-service incidents] non-200 from ${url}: ${res.status}`,
          );
          return { supported: false, incidents: [] };
        }
        const json = await res.json();
        const parsed = atlassianIncidentsResponseSchema.safeParse(json);
        if (!parsed.success) {
          console.warn(
            `[external-service incidents] invalid payload from ${url}`,
            parsed.error.issues,
          );
          return { supported: false, incidents: [] };
        }
        const incidents = parsed.data.incidents
          .slice(0, MAX_INCIDENTS)
          .map((i) => ({
            id: i.id,
            name: i.name,
            status: i.status,
            impact: i.impact,
            shortlink: i.shortlink,
            startedAt: i.started_at,
            createdAt: i.created_at,
            resolvedAt: i.resolved_at ?? null,
          }));
        return { supported: true, incidents };
      } catch (err) {
        console.warn(
          `[external-service incidents] fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return { supported: false, incidents: [] };
      } finally {
        clearTimeout(timer);
      }
    }),
});
