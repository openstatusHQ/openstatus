import { z } from "zod";
import { FetchError, fetchWithRetry } from "../fetch-utils";
import type {
  SeverityLevel,
  StatusFetcher,
  StatusPageEntry,
  StatusResult,
  StatusType,
} from "../types";

// UptimeRobot public status pages: no official docs.
// Endpoint observed in the wild: `<status_page_url>/api/getMonitorList/<userId>-<pspId>`.
// The page-id is unguessable, so operators must set it via api_config.endpoint.

const monitorRatioSchema = z.object({
  ratio: z.string(),
  label: z.string(),
  color: z.string(),
});

const monitorSchema = z.object({
  monitorId: z.number(),
  name: z.string(),
  statusClass: z.string(),
  url: z.string().nullable().optional(),
  type: z.string().optional(),
  ratio: monitorRatioSchema.optional(),
  "30dRatio": monitorRatioSchema.optional(),
  "90dRatio": monitorRatioSchema.optional(),
  hasIncidentComments: z.boolean().optional(),
  lastDowntime: z
    .object({
      date: z.string(),
      duration: z.number(),
      reason: z.string(),
    })
    .nullable()
    .optional(),
});

const uptimeRobotResponseSchema = z.object({
  status: z.literal("ok"),
  data: z.array(monitorSchema),
});

export class UptimeRobotFetcher implements StatusFetcher {
  name = "uptimerobot";

  canHandle(entry: StatusPageEntry): boolean {
    return (
      entry.api_config?.type === "uptimerobot" ||
      entry.provider === "uptime-robot"
    );
  }

  async fetch(entry: StatusPageEntry): Promise<StatusResult> {
    const apiUrl = entry.api_config?.endpoint;
    if (!apiUrl) {
      throw new FetchError(
        "UptimeRobot fetcher requires api_config.endpoint pointing at /api/getMonitorList/<userId>-<pspId>",
        entry.status_page_url,
        this.name,
        entry.id,
      );
    }

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
      const data = uptimeRobotResponseSchema.parse(json);

      const { severity, status, description } = this.aggregate(data.data);

      return {
        severity,
        status,
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

  private aggregate(monitors: z.infer<typeof monitorSchema>[]): {
    severity: SeverityLevel;
    status: StatusType;
    description: string;
  } {
    const total = monitors.length;

    if (total === 0) {
      return {
        severity: "none",
        status: "operational",
        description: "0 monitors down (0 total)",
      };
    }

    let success = 0;
    let danger = 0;
    let warning = 0;
    let maintenance = 0;

    for (const monitor of monitors) {
      switch (monitor.statusClass) {
        case "success":
          success++;
          break;
        case "danger":
          danger++;
          break;
        case "warning":
          warning++;
          break;
        case "paused":
        case "info":
          maintenance++;
          break;
        default:
          console.warn(
            `[uptimerobot] unknown statusClass "${monitor.statusClass}" for monitor "${monitor.name}" — folding to operational`,
          );
          success++;
      }
    }

    if (danger === total) {
      return {
        severity: "major",
        status: "major_outage",
        description:
          total === 1 ? "1 monitor down (1 total)" : `All ${total} monitors down`,
      };
    }

    if (danger > 0) {
      const desc =
        warning > 0
          ? `${danger} down, ${warning} degraded (${total} total)`
          : `${pluralMonitor(danger)} down (${total} total)`;
      return {
        severity: "major",
        status: "partial_outage",
        description: desc,
      };
    }

    if (warning > 0) {
      return {
        severity: "minor",
        status: "degraded",
        description: `${pluralMonitor(warning)} degraded (${total} total)`,
      };
    }

    if (maintenance > 0 && success === 0) {
      return {
        severity: "none",
        status: "under_maintenance",
        description: `${pluralMonitor(maintenance)} in maintenance (${total} total)`,
      };
    }

    return {
      severity: "none",
      status: "operational",
      description: `0 monitors down (${total} total)`,
    };
  }
}

function pluralMonitor(n: number): string {
  return `${n} ${n === 1 ? "monitor" : "monitors"}`;
}
