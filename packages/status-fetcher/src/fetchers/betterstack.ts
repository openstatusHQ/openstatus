import { z } from "zod";
import { FetchError, fetchWithRetry } from "../fetch-utils";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { urlHostnameEndsWith } from "../utils";

// DOCS: https://betterstack.com/docs/uptime/status-pages/subscribing-to-status-updates/subscribing-to-api/#access-the-json-endpoint

const betterStackResponseSchema = z.object({
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

  async fetch(entry: StatusPageEntry): Promise<StatusResult> {
    const apiUrl =
      entry.api_config?.endpoint || `${entry.status_page_url}/index.json`;

    try {
      const response = await fetchWithRetry(apiUrl, {
        headers: {
          "User-Agent": "OpenStatus-Directory/1.0",
          Accept: "application/json",
        },
        timeout: 30000,
      });

      if (!response.ok) {
        throw new FetchError(
          `HTTP ${response.status}: ${response.statusText}`,
          apiUrl,
          this.name,
          entry.id,
        );
      }

      const json = await response.json();
      const data = betterStackResponseSchema.parse(json);

      const { aggregate_state, updated_at, timezone } = data.data.attributes;
      const { severity, status, description } =
        this.mapAggregateState(aggregate_state);

      return {
        severity,
        status,
        description,
        updated_at: new Date(updated_at).getTime(),
        timezone: timezone,
      };
    } catch (error) {
      if (error instanceof FetchError) {
        throw error;
      }
      throw new FetchError(
        error instanceof Error ? error.message : "Unknown error",
        apiUrl,
        this.name,
        entry.id,
        error instanceof Error ? error : undefined,
      );
    }
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
