import { z } from "zod";
import { FetchError, fetchWithRetry } from "../fetch-utils";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { urlHostnameEndsWith } from "../utils";

// DOCS: https://help.incident.io/articles/7434055319-embed-your-status-page%27s-data-into-your-own-product
// NOTE: this only works if Widget API is enabled

const incidentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  last_update: z
    .object({
      message: z.string(),
      updated_at: z.string(),
    })
    .optional(),
  affected_components: z.array(z.string()).optional(),
});

const incidentioResponseSchema = z.object({
  ongoing_incidents: z.array(incidentSchema),
  in_progress_maintenances: z.array(incidentSchema),
  scheduled_maintenances: z.array(incidentSchema),
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

  async fetch(entry: StatusPageEntry): Promise<StatusResult> {
    const apiUrl = entry.api_config?.endpoint || this.constructApiUrl(entry);

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
      const data = incidentioResponseSchema.parse(json);

      const { severity, status, description } = this.analyzeIncidents(data);
      const latestUpdate = this.getLatestUpdateTime(data);

      return {
        severity,
        status,
        description,
        updated_at: latestUpdate,
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

  private constructApiUrl(entry: StatusPageEntry): string {
    const url = new URL(entry.status_page_url);
    return `${url.origin}/api/widget`;
  }

  private analyzeIncidents(data: z.infer<typeof incidentioResponseSchema>): {
    severity: "none" | "minor" | "major";
    status:
      | "operational"
      | "investigating"
      | "identified"
      | "monitoring"
      | "under_maintenance";
    description: string;
  } {
    const {
      ongoing_incidents,
      in_progress_maintenances,
      scheduled_maintenances,
    } = data;

    if (ongoing_incidents.length > 0) {
      const incident = ongoing_incidents[0];
      const incidentStatus = incident.status.toLowerCase();

      if (incidentStatus.includes("investigating")) {
        return {
          severity: "major",
          status: "investigating",
          description: `Incident: ${incident.name}`,
        };
      }
      if (incidentStatus.includes("identified")) {
        return {
          severity: "major",
          status: "identified",
          description: `Incident: ${incident.name}`,
        };
      }
      if (incidentStatus.includes("monitoring")) {
        return {
          severity: "minor",
          status: "monitoring",
          description: `Monitoring: ${incident.name}`,
        };
      }

      return {
        severity: "major",
        status: "investigating",
        description: incident.name,
      };
    }

    if (in_progress_maintenances.length > 0) {
      const maintenance = in_progress_maintenances[0];
      return {
        severity: "none",
        status: "under_maintenance",
        description: `Maintenance: ${maintenance.name}`,
      };
    }

    if (scheduled_maintenances.length > 0) {
      const maintenance = scheduled_maintenances[0];
      return {
        severity: "none",
        status: "operational",
        description: `All Systems Operational (Scheduled: ${maintenance.name})`,
      };
    }

    return {
      severity: "none",
      status: "operational",
      description: "All Systems Operational",
    };
  }

  private getLatestUpdateTime(
    data: z.infer<typeof incidentioResponseSchema>,
  ): number {
    const allItems = [
      ...data.ongoing_incidents,
      ...data.in_progress_maintenances,
      ...data.scheduled_maintenances,
    ];

    if (allItems.length === 0) return Date.now();

    const timestamps = allItems
      .filter((item) => item.last_update?.updated_at)
      .map((item) => new Date(item.last_update?.updated_at).getTime());

    return timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
  }
}
