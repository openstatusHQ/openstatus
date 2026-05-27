import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getExternalServiceBySlug,
  listExternalServices,
} from "@openstatus/services/external-service";
import { listExternalIncidentsBySlug } from "@openstatus/services/external-service-incident";
import { OSTinybird } from "@openstatus/tinybird";

import { env } from "../env";
import { createTRPCRouter, publicProcedure } from "../trpc";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

const DEFAULT_HISTORY_DAYS = 45;
const INCIDENTS_LIMIT = 5;

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
        history: historyRows.map((r) => ({
          day: r.day,
          worstIndicator: r.worst_indicator,
          hadMaintenance: r.had_maintenance,
          snapshotCount: r.snapshot_count,
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
      const { supported, incidents } = await listExternalIncidentsBySlug({
        slug: input.slug,
        limit: INCIDENTS_LIMIT,
      });
      if (!supported) {
        return { supported: false, incidents: [] };
      }
      return {
        supported: true,
        incidents: incidents.map((i) => ({
          id: i.providerIncidentId,
          name: i.name,
          status: i.status,
          impact: i.impact ?? undefined,
          shortlink: i.shortlink ?? undefined,
          startedAt: i.startedAt?.toISOString(),
          createdAt: i.createdAt.toISOString(),
          resolvedAt: i.resolvedAt?.toISOString() ?? null,
        })),
      };
    }),
});
