import { Effect } from "effect";
import { parse } from "node-html-parser";
import { FetchError, fetchText } from "../fetch";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { inferStatus } from "../utils";

export class HtmlScraperFetcher implements StatusFetcher {
  name = "html-scraper";

  canHandle(entry: StatusPageEntry): boolean {
    return entry.api_config?.type === "html-scraper";
  }

  fetch(entry: StatusPageEntry): Effect.Effect<StatusResult, FetchError> {
    return fetchText({
      url: entry.status_page_url,
      fetcherName: this.name,
      entryId: entry.id,
    }).pipe(
      Effect.map((html) => {
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
      }),
    );
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
