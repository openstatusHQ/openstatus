import { Effect } from "effect";
import { z } from "zod";

import { type FetchError, fetchJson } from "../fetch";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { urlHostnameEndsWith } from "../utils";

export const instatusResponseSchema = z.object({
  activeIncidents: z.array(z.unknown()),
  activeMaintenances: z.array(z.unknown()),
  status: z.object({
    text: z.string(),
    type: z.enum(["UP", "HASISSUES", "UNDERMAINTENANCE"]),
  }),
  page: z.object({
    name: z.string(),
    url: z.string(),
    updated: z.string(),
  }),
});

export class InstatusFetcher implements StatusFetcher {
  name = "instatus";

  canHandle(entry: StatusPageEntry): boolean {
    return (
      entry.api_config?.type === "instatus" ||
      entry.provider === "instatus" ||
      urlHostnameEndsWith(entry.status_page_url, "instatus.com")
    );
  }

  fetch(entry: StatusPageEntry): Effect.Effect<StatusResult, FetchError> {
    const apiUrl =
      entry.api_config?.endpoint || `${entry.status_page_url}/summary.json`;

    return fetchJson({
      url: apiUrl,
      schema: instatusResponseSchema,
      fetcherName: this.name,
      entryId: entry.id,
    }).pipe(
      Effect.map((data) => {
        const mapping = this.mapInstatusType(data.status.type);
        return {
          severity: mapping.severity,
          status: mapping.status,
          description: data.status.text,
          updated_at: new Date(data.page.updated).getTime(),
          timezone: "UTC",
        };
      }),
    );
  }

  private mapInstatusType(type: "UP" | "HASISSUES" | "UNDERMAINTENANCE"): {
    severity: "none" | "minor" | "major";
    status: "operational" | "degraded" | "under_maintenance";
  } {
    switch (type) {
      case "UP":
        return { severity: "none", status: "operational" };
      case "HASISSUES":
        return { severity: "major", status: "degraded" };
      case "UNDERMAINTENANCE":
        return { severity: "none", status: "under_maintenance" };
      default:
        return { severity: "none", status: "operational" };
    }
  }
}
