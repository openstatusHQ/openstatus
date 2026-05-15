import { z } from "zod";
import { FetchError, fetchWithRetry } from "../fetch-utils";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { SEVERITY_LEVELS } from "../types";
import { inferStatus, urlHostnameEndsWith } from "../utils";

// DOCS: https://status.atlassian.com/api

const atlassianResponseSchema = z.object({
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

  async fetch(entry: StatusPageEntry): Promise<StatusResult> {
    // Construct API URL
    // Format: https://[id].statuspage.io/api/v2/summary.json
    const apiUrl =
      entry.api_config?.endpoint ||
      `${entry.status_page_url}/api/v2/summary.json`;

    try {
      const response = await fetchWithRetry(apiUrl, {
        headers: {
          "User-Agent": "OpenStatus-Directory/1.0",
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
      const data = atlassianResponseSchema.parse(json);

      const severity = data.status.indicator;
      const description = data.status.description;

      return {
        severity,
        status: inferStatus(description, severity),
        description,
        updated_at: new Date(data.page.updated_at).getTime(),
        timezone: data.page.timezone,
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
}
