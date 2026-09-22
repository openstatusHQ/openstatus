import { Effect } from "effect";
import { z } from "zod";

import { type FetchError, fetchJson } from "../fetch";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { urlHostnameEndsWith } from "../utils";

export const betterStackResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    type: z.literal("status_page"),
    attributes: z.object({
      company_name: z.string(),
      timezone: z.string(),
      aggregate_state: z.enum([
        "operational",
        "degraded",
        "downtime",
        "maintenance",
      ]),
      updated_at: z.string(),
    }),
  }),
  included: z.array(z.unknown()).optional(),
});

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

  fetch(entry: StatusPageEntry): Effect.Effect<StatusResult, FetchError> {
    const apiUrl =
      entry.api_config?.endpoint || `${entry.status_page_url}/index.json`;

    return fetchJson({
      url: apiUrl,
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

  private mapAggregateState(
    state: "operational" | "degraded" | "downtime" | "maintenance",
  ): {
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
