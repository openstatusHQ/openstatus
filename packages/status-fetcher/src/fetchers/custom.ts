import { Effect } from "effect";
import { z } from "zod";
import { FetchError, fetchJson } from "../fetch";
import type { StatusFetcher, StatusPageEntry, StatusResult } from "../types";
import { inferStatus } from "../utils";

const slackSchema = z.object({
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

const genericShape = z.object({
  status: z.string().optional(),
  state: z.string().optional(),
  health: z.string().optional(),
  description: z.string().optional(),
  message: z.string().optional(),
});

type SlackData = z.infer<typeof slackSchema>;
type GenericData = z.infer<typeof genericShape>;

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

export class CustomApiFetcher implements StatusFetcher {
  name = "custom";

  canHandle(entry: StatusPageEntry): boolean {
    return entry.api_config?.type === "custom";
  }

  fetch(entry: StatusPageEntry): Effect.Effect<StatusResult, FetchError> {
    const apiUrl = entry.api_config?.endpoint;
    if (!apiUrl) {
      return Effect.fail(
        new FetchError({
          url: entry.status_page_url,
          fetcherName: this.name,
          entryId: entry.id,
          cause: new Error("Custom API requires explicit endpoint configuration"),
        }),
      );
    }

    const parser = entry.api_config?.parser || "generic";
    const errorCtx = { url: apiUrl, fetcherName: this.name, entryId: entry.id };

    switch (parser) {
      case "slack":
        return fetchJson({
          ...errorCtx,
          schema: slackSchema,
        }).pipe(Effect.map((data) => this.parseSlack(data)));
      case "aws":
        return Effect.fail(
          new FetchError({
            ...errorCtx,
            cause: new Error("AWS parser not implemented - uses RSS feeds"),
          }),
        );
      default:
        return fetchJson({
          ...errorCtx,
          schema: genericShape,
        }).pipe(
          Effect.flatMap((data) =>
            Effect.try({
              try: () => this.parseGeneric(data),
              catch: (cause) =>
                new FetchError({ ...errorCtx, cause: toError(cause) }),
            }),
          ),
        );
    }
  }

  private parseSlack(data: SlackData): StatusResult {
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

  private parseGeneric(parsed: GenericData): StatusResult {
    const statusField =
      parsed.status || parsed.state || parsed.health || "unknown";
    const descriptionField =
      parsed.description || parsed.message || String(statusField);

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
