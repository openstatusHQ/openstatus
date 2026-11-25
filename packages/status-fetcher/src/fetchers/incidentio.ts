import { Effect } from "effect";
import { z } from "zod";

import { fetchAtlassianCompatibleComponents } from "../components";
import { type FetchError, fetchJson } from "../fetch";
import { fetchAtlassianCompatibleIncidents } from "../incidents";
import type {
  NormalizedComponent,
  NormalizedIncident,
  StatusFetcher,
  StatusPageEntry,
  StatusResult,
} from "../types";
import { SEVERITY_LEVELS } from "../types";
import { urlHostnameEndsWith } from "../utils";
import { normalizeAtlassianSummary } from "./atlassian";

// incident.io status pages expose an Atlassian Statuspage-compatible API, so the
// summary endpoint returns the same shape AtlassianFetcher consumes. Kept as
// its own schema so the two can drift independently.
const incidentioResponseSchema = z.object({
  page: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url(),
    timezone: z.string().optional(),
    updated_at: z.string().datetime({ offset: true }),
  }),
  status: z.object({
    indicator: z.enum([...SEVERITY_LEVELS, "maintenance"]),
    description: z.string(),
  }),
});

export class IncidentioFetcher implements StatusFetcher {
  name = "incidentio";

  canHandle(entry: StatusPageEntry): boolean {
    return (
      entry.api_config?.type === "incidentio" ||
      entry.provider === "incidentio" ||
      urlHostnameEndsWith(entry.status_page_url, "incident.io") ||
      urlHostnameEndsWith(entry.status_page_url, "incidentio.com")
    );
  }

  fetch(entry: StatusPageEntry): Effect.Effect<StatusResult, FetchError> {
    const apiUrl =
      entry.api_config?.endpoint ||
      `${entry.status_page_url}/api/v2/summary.json`;

    return fetchJson({
      url: apiUrl,
      schema: incidentioResponseSchema,
      fetcherName: this.name,
      entryId: entry.id,
    }).pipe(Effect.map(normalizeAtlassianSummary));
  }

  fetchIncidents(
    entry: StatusPageEntry,
  ): Effect.Effect<NormalizedIncident[], FetchError> {
    return fetchAtlassianCompatibleIncidents({ entry, fetcherName: this.name });
  }

  fetchComponents(
    entry: StatusPageEntry,
  ): Effect.Effect<NormalizedComponent[], FetchError> {
    return fetchAtlassianCompatibleComponents({
      entry,
      fetcherName: this.name,
    });
  }
}
