import { Effect } from "effect";
import { z } from "zod";
import { type FetchError, fetchJson } from "../fetch";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { SEVERITY_LEVELS } from "../types";
import { inferStatus, urlHostnameEndsWith } from "../utils";

// incident.io status pages expose an Atlassian Statuspage-compatible API, so the
// summary endpoint returns the same shape AtlassianFetcher consumes.
const incidentioResponseSchema = z.object({
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
}
