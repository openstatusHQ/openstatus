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

export const atlassianResponseSchema = z.object({
  page: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url(),
    timezone: z.string().optional(),
    updated_at: z.string().datetime({ offset: true }),
  }),
  status: z.object({
    indicator: z.enum(SEVERITY_LEVELS),
    description: z.string(),
  }),
});

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
    }).pipe(
      Effect.map((data) => {
        const severity = data.status.indicator;
        const description = data.status.description;
        return {
          severity,
          status: inferStatus(description, severity),
          description,
          updated_at: new Date(data.page.updated_at).getTime(),
          timezone: data.page.timezone,
        };
      }),
    );
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
