import { z } from "zod";
import { FetchError, fetchWithRetry } from "../fetch-utils";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { inferStatus } from "../utils";

export class CustomApiFetcher implements StatusFetcher {
  name = "custom";

  canHandle(entry: StatusPageEntry): boolean {
    return entry.api_config?.type === "custom";
  }

  async fetch(entry: StatusPageEntry): Promise<StatusResult> {
    if (!entry.api_config?.endpoint) {
      throw new FetchError(
        "Custom API requires explicit endpoint configuration",
        "",
        this.name,
        entry.id,
      );
    }

    const apiUrl = entry.api_config.endpoint;

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
      const parser = entry.api_config.parser || "generic";
      return this.parseResponse(json, parser);
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

  private parseResponse(json: unknown, parser: string): StatusResult {
    switch (parser) {
      case "slack":
        return this.parseSlack(json);
      case "aws":
        return this.parseAws(json);
      default:
        return this.parseGeneric(json);
    }
  }

  /**
   * Slack Status API v2.0.0 parser
   * API: https://slack-status.com/api/v2.0.0/current
   * Docs: https://docs.slack.dev/reference/slack-status-api/
   */
  private parseSlack(json: unknown): StatusResult {
    const schema = z.object({
      status: z.enum(["ok", "active", "resolved"]),
      date_created: z.union([z.number(), z.string()]),
      date_updated: z.union([z.number(), z.string()]),
      active_incidents: z.array(
        z.object({
          id: z.number(),
          title: z.string(),
          type: z.enum(["incident", "notice", "outage"]),
          status: z.string(),
          services: z.array(z.string()),
        }),
      ),
    });

    const data = schema.parse(json);
    const hasActiveIncidents = data.active_incidents.length > 0;
    const hasOutage = data.active_incidents.some((i) => i.type === "outage");

    let severity: "none" | "minor" | "major";
    let statusType: "operational" | "major_outage" | "degraded";
    let description: string;

    if (!hasActiveIncidents || data.status === "ok") {
      severity = "none";
      statusType = "operational";
      description = "All Systems Operational";
    } else if (hasOutage) {
      severity = "major";
      statusType = "major_outage";
      description = data.active_incidents[0].title;
    } else {
      severity = "minor";
      statusType = "degraded";
      description = data.active_incidents[0].title;
    }

    // Handle both number (seconds) and string (ISO) timestamps
    const dateUpdated =
      typeof data.date_updated === "number"
        ? data.date_updated * 1000
        : new Date(data.date_updated).getTime();

    return {
      severity,
      status: statusType,
      description,
      updated_at: dateUpdated,
      timezone: "UTC",
    };
  }

  /**
   * AWS Health Dashboard parser (placeholder)
   */
  private parseAws(_json: unknown): StatusResult {
    throw new Error("AWS parser not implemented - uses RSS feeds");
  }

  /**
   * Generic parser for unknown custom APIs
   */
  private parseGeneric(json: unknown): StatusResult {
    const jsonObject = json as {
      status?: string;
      state?: string;
      health?: string;
      description?: string;
      message?: string;
    };
    const statusField =
      jsonObject.status || jsonObject.state || jsonObject.health || "unknown";
    const descriptionField =
      jsonObject.description || jsonObject.message || String(statusField);

    const statusLower = String(statusField).toLowerCase();
    let severity: "none" | "minor" | "major" = "none";

    if (statusLower.includes("down") || statusLower.includes("outage")) {
      severity = "major";
    } else if (
      statusLower.includes("degraded") ||
      statusLower.includes("partial")
    ) {
      severity = "minor";
    } else if (statusLower.includes("maintenance")) {
      severity = "minor";
    }

    const description = String(descriptionField);

    return {
      severity,
      status: inferStatus(description, severity),
      description,
      updated_at: Date.now(),
      timezone: "UTC",
    };
  }
}
