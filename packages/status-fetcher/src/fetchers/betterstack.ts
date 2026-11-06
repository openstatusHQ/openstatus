import { Effect } from "effect";
import { z } from "zod";

import { type FetchError, fetchJson, fetchJsonWithRaw } from "../fetch";
import type {
  JsonValue,
  NormalizedComponent,
  NormalizedIncident,
  StatusFetcher,
  StatusPageEntry,
  StatusResult,
} from "../types";
import { urlHostnameEndsWith } from "../utils";

const AGGREGATE_STATES = [
  "operational",
  "degraded",
  "downtime",
  "maintenance",
] as const;

type AggregateState = (typeof AGGREGATE_STATES)[number];

const isAggregateState = (value: string | null): value is AggregateState =>
  AGGREGATE_STATES.some((state) => state === value);

export const betterStackResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    type: z.literal("status_page"),
    attributes: z.object({
      company_name: z.string(),
      timezone: z.string(),
      aggregate_state: z.enum(AGGREGATE_STATES),
      updated_at: z.string(),
    }),
  }),
  included: z.array(z.unknown()).optional(),
});

const timestampSchema = z.string().datetime({ offset: true });

const affectedResourcesSchema = z
  .array(
    z.object({
      status_page_resource_id: z.coerce.string(),
      status: z.string().nullable(),
    }),
  )
  .default([]);

const includedItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status_page_section"),
    id: z.string(),
    attributes: z.object({
      name: z.string().nullable(),
      position: z.number().nullable(),
    }),
  }),
  z.object({
    type: z.literal("status_page_resource"),
    id: z.string(),
    attributes: z.object({
      status_page_section_id: z.coerce.string().nullable(),
      public_name: z.string().nullable(),
      explanation: z.string().nullable(),
      position: z.number().nullable(),
      status: z.string().nullable(),
    }),
  }),
  z.object({
    type: z.literal("status_report"),
    id: z.string(),
    attributes: z.object({
      title: z.string(),
      report_type: z.string(),
      starts_at: timestampSchema.nullable(),
      ends_at: timestampSchema.nullable(),
      affected_resources: affectedResourcesSchema,
      aggregate_state: z.string().nullable(),
    }),
    relationships: z
      .object({
        status_updates: z.object({
          data: z.array(z.object({ id: z.string() })),
        }),
      })
      .optional(),
  }),
  z.object({
    type: z.literal("status_update"),
    id: z.string(),
    attributes: z.object({
      published_at: timestampSchema,
      affected_resources: affectedResourcesSchema,
    }),
  }),
]);

type IncludedItem = z.infer<typeof includedItemSchema>;
type IncludedType = IncludedItem["type"];

const INCLUDED_TYPES = new Set<unknown>([
  "status_page_section",
  "status_page_resource",
  "status_report",
  "status_update",
] satisfies IncludedType[]);

// Separate from `betterStackResponseSchema` so a change in these sideloaded
// records can't break status polling or provider detection. Record types we
// don't consume are dropped; a malformed record of a known type still fails.
const betterStackIncludedResponseSchema = z.object({
  included: z
    .array(z.unknown())
    .default([])
    .transform((items) =>
      items.filter(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          INCLUDED_TYPES.has(item.type),
      ),
    )
    .pipe(z.array(includedItemSchema)),
});

const ofType = <T extends IncludedType>(items: IncludedItem[], type: T) =>
  items.filter(
    (item): item is Extract<IncludedItem, { type: T }> => item.type === type,
  );

const rawIncludedByKey = (raw: JsonValue): Map<string, JsonValue> => {
  const out = new Map<string, JsonValue>();
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return out;
  const { included } = raw;
  if (!Array.isArray(included)) return out;
  for (const item of included) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    out.set(`${item.type}:${item.id}`, item);
  }
  return out;
};

const worstImpact = (states: (string | null)[]): string | undefined => {
  const lower = states.map((state) => state?.toLowerCase());
  if (lower.includes("downtime")) return "major";
  if (lower.includes("degraded")) return "minor";
  return undefined;
};

export class BetterStackFetcher implements StatusFetcher {
  name = "betterstack";

  canHandle(entry: StatusPageEntry): boolean {
    return (
      entry.api_config?.type === "betterstack" ||
      entry.provider === "better-uptime" ||
      urlHostnameEndsWith(entry.status_page_url, "betteruptime.com") ||
      urlHostnameEndsWith(entry.status_page_url, "betterstack.com")
    );
  }

  private apiUrl(entry: StatusPageEntry): string {
    return entry.api_config?.endpoint || `${entry.status_page_url}/index.json`;
  }

  fetchComponents(
    entry: StatusPageEntry,
  ): Effect.Effect<NormalizedComponent[], FetchError> {
    return fetchJson({
      url: this.apiUrl(entry),
      schema: betterStackIncludedResponseSchema,
      fetcherName: this.name,
      entryId: entry.id,
    }).pipe(Effect.map(({ included }) => this.normalizeComponents(included)));
  }

  fetchIncidents(
    entry: StatusPageEntry,
  ): Effect.Effect<NormalizedIncident[], FetchError> {
    return fetchJsonWithRaw({
      url: this.apiUrl(entry),
      schema: betterStackIncludedResponseSchema,
      fetcherName: this.name,
      entryId: entry.id,
    }).pipe(
      Effect.map(({ parsed, raw }) =>
        this.normalizeIncidents(parsed.included, raw, entry),
      ),
    );
  }

  private normalizeComponents(included: IncludedItem[]): NormalizedComponent[] {
    const sections = new Map(
      ofType(included, "status_page_section").map((section) => [
        section.id,
        section.attributes,
      ]),
    );
    const sectionPosition = (id: string | null) =>
      (id ? sections.get(id)?.position : null) ?? -1;

    // Resource positions restart in every section, while the page orders a
    // service's components by a single `position`, so flatten them here.
    const ordered = ofType(included, "status_page_resource").sort(
      (a, b) =>
        sectionPosition(a.attributes.status_page_section_id) -
          sectionPosition(b.attributes.status_page_section_id) ||
        (a.attributes.position ?? 0) - (b.attributes.position ?? 0),
    );

    const out: NormalizedComponent[] = [];
    for (const { id, attributes } of ordered) {
      const name = attributes.public_name?.trim();
      // `not_monitored` resources have no status to report: mapping them to
      // operational would draw uptime bars for something nobody measures.
      if (!name || !isAggregateState(attributes.status)) continue;
      const { severity, status } = this.mapAggregateState(attributes.status);
      const sectionId = attributes.status_page_section_id;
      out.push({
        upstreamComponentId: id,
        name,
        description: attributes.explanation?.trim() || undefined,
        groupName:
          (sectionId ? sections.get(sectionId)?.name?.trim() : undefined) ||
          undefined,
        position: out.length,
        severity,
        status,
      });
    }
    return out;
  }

  private normalizeIncidents(
    included: IncludedItem[],
    raw: JsonValue,
    entry: StatusPageEntry,
  ): NormalizedIncident[] {
    const updatesById = new Map(
      ofType(included, "status_update").map((update) => [update.id, update]),
    );
    const rawByKey = rawIncludedByKey(raw);
    const now = Date.now();

    const out: NormalizedIncident[] = [];
    for (const report of ofType(included, "status_report")) {
      const { attributes } = report;
      const updates = (report.relationships?.status_updates.data ?? [])
        .flatMap(({ id }) => updatesById.get(id) ?? [])
        .sort(
          (a, b) =>
            Date.parse(a.attributes.published_at) -
            Date.parse(b.attributes.published_at),
        );
      const firstPublishedAt = updates[0]?.attributes.published_at;
      const lastPublishedAt = updates.at(-1)?.attributes.published_at;

      const startedAt = attributes.starts_at ?? firstPublishedAt;
      if (!startedAt) continue;

      const isMaintenance = attributes.report_type === "maintenance";
      // A scheduled window that hasn't begun isn't an incident yet; it would
      // otherwise read as ongoing. It gets picked up once it starts.
      if (isMaintenance && Date.parse(startedAt) > now) continue;

      const state = attributes.aggregate_state?.toLowerCase();
      // `ends_at` is null on resolved manual reports, and can be in the future
      // on a window closed early: fall back to the last update in both cases.
      const endedAt =
        attributes.ends_at && Date.parse(attributes.ends_at) <= now
          ? attributes.ends_at
          : null;
      const resolvedAt =
        endedAt ??
        (state === "resolved" ? (lastPublishedAt ?? startedAt) : null);

      out.push({
        providerIncidentId: report.id,
        name: attributes.title,
        status: state ?? (resolvedAt ? "resolved" : "investigating"),
        impact: isMaintenance
          ? "maintenance"
          : worstImpact(
              [attributes, ...updates.map((u) => u.attributes)].flatMap((a) =>
                a.affected_resources.map((resource) => resource.status),
              ),
            ),
        // The page's `/incidents/<id>` fallback is Atlassian's path; Better
        // Stack redirects it to the page root.
        shortlink: `${entry.status_page_url}/incident/${report.id}`,
        startedAt: new Date(startedAt),
        createdAt: new Date(firstPublishedAt ?? startedAt),
        resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
        affectedComponentIds: attributes.affected_resources.map(
          (resource) => resource.status_page_resource_id,
        ),
        raw: {
          report: rawByKey.get(`status_report:${report.id}`) ?? null,
          updates: updates.map(
            (update) => rawByKey.get(`status_update:${update.id}`) ?? null,
          ),
        },
      });
    }
    return out;
  }

  fetch(entry: StatusPageEntry): Effect.Effect<StatusResult, FetchError> {
    return fetchJson({
      url: this.apiUrl(entry),
      schema: betterStackResponseSchema,
      fetcherName: this.name,
      entryId: entry.id,
    }).pipe(
      Effect.map((data) => {
        const { aggregate_state, updated_at, timezone } = data.data.attributes;
        const { severity, status, description } =
          this.mapAggregateState(aggregate_state);
        return {
          severity,
          status,
          description,
          updated_at: new Date(updated_at).getTime(),
          timezone,
        };
      }),
    );
  }

  private mapAggregateState(state: AggregateState): {
    severity: "none" | "minor" | "major";
    status: "operational" | "degraded" | "major_outage" | "under_maintenance";
    description: string;
  } {
    switch (state) {
      case "operational":
        return {
          severity: "none",
          status: "operational",
          description: "All Systems Operational",
        };
      case "degraded":
        return {
          severity: "minor",
          status: "degraded",
          description: "Degraded Service",
        };
      case "downtime":
        return {
          severity: "major",
          status: "major_outage",
          description: "Service Outage",
        };
      case "maintenance":
        return {
          severity: "none",
          status: "under_maintenance",
          description: "Maintenance Mode",
        };
      default:
        return {
          severity: "none",
          status: "operational",
          description: "Unknown Status",
        };
    }
  }
}
