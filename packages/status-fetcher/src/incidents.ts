import { Effect } from "effect";
import { z } from "zod";
import { type FetchError, fetchJsonWithRaw } from "./fetch";
import type { JsonValue, NormalizedIncident, StatusPageEntry } from "./types";

export const atlassianIncidentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  impact: z.string().optional(),
  shortlink: z.string().optional(),
  started_at: z.string().optional(),
  created_at: z.string(),
  resolved_at: z.string().nullable().optional(),
});

export const atlassianIncidentsResponseSchema = z.object({
  incidents: z.array(atlassianIncidentSchema),
});

export type AtlassianIncident = z.infer<typeof atlassianIncidentSchema>;

const isJsonObject = (
  value: JsonValue,
): value is { [key: string]: JsonValue } =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const rawIncidentsArray = (raw: JsonValue): JsonValue[] => {
  if (!isJsonObject(raw)) return [];
  const incidents = raw.incidents;
  return Array.isArray(incidents) ? incidents : [];
};

const normalizeAtlassianIncident = (
  parsed: AtlassianIncident,
  raw: JsonValue,
): NormalizedIncident => ({
  providerIncidentId: parsed.id,
  name: parsed.name,
  status: parsed.status,
  impact: parsed.impact,
  shortlink: parsed.shortlink,
  startedAt: parsed.started_at ? new Date(parsed.started_at) : undefined,
  createdAt: new Date(parsed.created_at),
  resolvedAt: parsed.resolved_at ? new Date(parsed.resolved_at) : null,
  raw,
});

export const fetchAtlassianCompatibleIncidents = (args: {
  entry: StatusPageEntry;
  fetcherName: string;
}): Effect.Effect<NormalizedIncident[], FetchError> => {
  const { entry, fetcherName } = args;
  // `api_config.endpoint` overrides the summary URL only; incidents always
  // come from the standard `/api/v2/incidents.json` path under status_page_url.
  const url = `${entry.status_page_url}/api/v2/incidents.json`;
  return fetchJsonWithRaw({
    url,
    schema: atlassianIncidentsResponseSchema,
    fetcherName,
    entryId: entry.id,
  }).pipe(
    Effect.map(({ parsed, raw }) => {
      const rawList = rawIncidentsArray(raw);
      return parsed.incidents.map((incident, index) =>
        normalizeAtlassianIncident(incident, rawList[index] ?? {}),
      );
    }),
  );
};
