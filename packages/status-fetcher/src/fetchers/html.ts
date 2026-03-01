import { parse } from "node-html-parser";
import { FetchError, fetchWithRetry } from "../fetch-utils";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { inferStatus } from "../utils";

export class HtmlScraperFetcher implements StatusFetcher {
  name = "html-scraper";

  canHandle(entry: StatusPageEntry): boolean {
    // Fallback fetcher - only use if explicitly enabled
    return entry.api_config?.type === "html-scraper";
  }

  async fetch(entry: StatusPageEntry): Promise<StatusResult> {
    const apiUrl = entry.status_page_url;

    try {
      const response = await fetchWithRetry(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OpenStatus-Bot/1.0)",
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

      const html = await response.text();
      const root = parse(html);

      const patterns = [
        { selector: '[class*="status"]', attr: "textContent" },
        { selector: "[data-status]", attr: "data-status" },
        { selector: 'meta[name="status"]', attr: "content" },
      ];

      let description = "Unknown";
      let severity: "none" | "minor" | "major" = "none";

      for (const pattern of patterns) {
        const element = root.querySelector(pattern.selector);
        if (element) {
          const text =
            pattern.attr === "textContent"
              ? element.textContent
              : element.getAttribute(pattern.attr);

          if (text) {
            description = text.trim();
            severity = this.inferSeverity(description);
            break;
          }
        }
      }

      return {
        severity,
        status: inferStatus(description, severity),
        description,
        updated_at: Date.now(),
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

  private inferSeverity(text: string): "none" | "minor" | "major" {
    const lower = text.toLowerCase();

    if (lower.includes("operational") || lower.includes("all systems")) {
      return "none";
    }
    if (lower.includes("degraded") || lower.includes("partial")) {
      return "minor";
    }
    if (lower.includes("outage") || lower.includes("down")) {
      return "major";
    }

    return "none";
  }
}
