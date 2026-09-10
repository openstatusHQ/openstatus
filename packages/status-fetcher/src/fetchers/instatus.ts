import { Effect } from "effect";
import { z } from "zod";

import { type FetchError, fetchJson } from "../fetch";
import type {
  SeverityLevel,
  StatusFetcher,
  StatusPageEntry,
  StatusResult,
  StatusType,
} from "../types";
import { urlHostnameEndsWith } from "../utils";

// Public summary.json per https://instatus.com/help/api/public-data. The two
// arrays are omitted entirely when empty.
const instatusIncidentSchema = z.object({
  name: z.string(),
  started: z.string().optional(),
  status: z.string().optional(),
  impact: z.string().optional(),
  url: z.string().optional(),
});

const instatusMaintenanceSchema = z.object({
  name: z.string(),
  start: z.string().optional(),
  status: z.string().optional(),
  duration: z.string().optional(),
  url: z.string().optional(),
});

export const instatusResponseSchema = z.object({
  page: z.object({
    name: z.string(),
    url: z.string(),
    status: z.enum(["UP", "HASISSUES", "UNDERMAINTENANCE"]),
  }),
  activeIncidents: z.array(instatusIncidentSchema).optional().default([]),
  activeMaintenances: z.array(instatusMaintenanceSchema).optional().default([]),
});

type InstatusResponse = z.infer<typeof instatusResponseSchema>;

const IMPACT_RANK: Record<
  string,
  { rank: number; severity: SeverityLevel; status: StatusType }
> = {
  MAJOROUTAGE: { rank: 3, severity: "critical", status: "major_outage" },
  PARTIALOUTAGE: { rank: 2, severity: "major", status: "partial_outage" },
  DEGRADEDPERFORMANCE: { rank: 1, severity: "minor", status: "degraded" },
};

const latestTimestamp = (values: (string | undefined)[]): number => {
  let latest = 0;
  for (const value of values) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  return latest || Date.now();
};

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
    }).pipe(Effect.map((data) => this.normalize(data)));
  }

  private normalize(data: InstatusResponse): StatusResult {
    const { activeIncidents, activeMaintenances } = data;
    const updated_at = latestTimestamp([
      ...activeIncidents.map((i) => i.started),
      ...activeMaintenances.map((m) => m.start),
    ]);

    switch (data.page.status) {
      case "UNDERMAINTENANCE":
        return {
          severity: "none",
          status: "under_maintenance",
          description:
            activeMaintenances.map((m) => m.name).join(", ") ||
            "Under Maintenance",
          updated_at,
          timezone: "UTC",
        };
      case "HASISSUES": {
        // Worst active incident impact wins; unknown impacts fold to degraded.
        let worst = { rank: 0, severity: "major", status: "degraded" } as {
          rank: number;
          severity: SeverityLevel;
          status: StatusType;
        };
        for (const incident of activeIncidents) {
          const mapped = IMPACT_RANK[incident.impact ?? ""];
          if (mapped && mapped.rank > worst.rank) worst = mapped;
        }
        return {
          severity: worst.severity,
          status: worst.status,
          description:
            activeIncidents.map((i) => i.name).join(", ") ||
            "Experiencing issues",
          updated_at,
          timezone: "UTC",
        };
      }
      default:
        return {
          severity: "none",
          status: "operational",
          description: "All Systems Operational",
          updated_at,
          timezone: "UTC",
        };
    }
  }
}
