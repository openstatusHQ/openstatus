import { z } from "zod";
import { FetchError, fetchWithRetry } from "../fetch-utils";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { urlHostnameEndsWith } from "../utils";

// DOCS: https://instatus.com/help/status-page/widgets

const instatusResponseSchema = z.object({
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

  async fetch(entry: StatusPageEntry): Promise<StatusResult> {
    const apiUrl =
      entry.api_config?.endpoint || `${entry.status_page_url}/summary.json`;

    try {
      const response = await fetchWithRetry(apiUrl, {
        headers: { "User-Agent": "OpenStatus-Directory/1.0" },
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
      const data = instatusResponseSchema.parse(json);

      const mapping = this.mapInstatusType(data.status.type);

      return {
        severity: mapping.severity,
        status: mapping.status,
        description: data.status.text,
        updated_at: new Date(data.page.updated).getTime(),
        timezone: "UTC",
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
