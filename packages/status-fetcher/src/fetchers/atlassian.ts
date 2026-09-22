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
import { inferStatus, urlHostnameEndsWith } from "../utils";

// Statuspage reports "maintenance" as a fifth indicator while a scheduled
// maintenance is in progress; it is not a severity, so it maps to none.
export const atlassianResponseSchema = z.object({
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

export type AtlassianSummary = z.infer<typeof atlassianResponseSchema>;

export const normalizeAtlassianSummary = (
  data: AtlassianSummary,
): StatusResult => {
  const description = data.status.description;
  const indicator = data.status.indicator;
  const severity = indicator === "maintenance" ? "none" : indicator;
  return {
    severity,
    status:
      indicator === "maintenance"
        ? "under_maintenance"
        : inferStatus(description, severity),
    description,
    updated_at: new Date(data.page.updated_at).getTime(),
    timezone: data.page.timezone,
  };
};

export class AtlassianFetcher implements StatusFetcher {
  name = "atlassian";

  canHandle(entry: StatusPageEntry): boolean {
    return (
      entry.api_config?.type === "atlassian" ||
      entry.provider === "atlassian-statuspage" ||
      urlHostnameEndsWith(entry.status_page_url, "statuspage.io")
    );
  }

  fetch(entry: StatusPageEntry): Effect.Effect<StatusResult, FetchError> {
    const apiUrl =
      entry.api_config?.endpoint ||
      `${entry.status_page_url}/api/v2/summary.json`;

    return fetchJson({
      url: apiUrl,
      schema: atlassianResponseSchema,
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
