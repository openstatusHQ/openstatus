import { Effect } from "effect";
import { z } from "zod";

import { FetchError, fetchJson } from "../fetch";
import type {
  SeverityLevel,
  StatusFetcher,
  StatusPageEntry,
  StatusResult,
  StatusType,
} from "../types";

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

type Monitor = z.infer<typeof monitorSchema>;

export class UptimeRobotFetcher implements StatusFetcher {
  name = "uptimerobot";

  canHandle(entry: StatusPageEntry): boolean {
    return (
      entry.api_config?.type === "uptimerobot" ||
      entry.provider === "uptime-robot"
    );
  }

  fetch(entry: StatusPageEntry): Effect.Effect<StatusResult, FetchError> {
    const apiUrl = entry.api_config?.endpoint;
    if (!apiUrl) {
      return Effect.fail(
        new FetchError({
          url: entry.status_page_url,
          fetcherName: this.name,
          entryId: entry.id,
          cause: new Error(
            "UptimeRobot fetcher requires api_config.endpoint pointing at /api/getMonitorList/<userId>-<pspId>",
          ),
        }),
      );
    }

    return fetchJson({
      url: apiUrl,
      schema: uptimeRobotResponseSchema,
      fetcherName: this.name,
      entryId: entry.id,
    }).pipe(
      Effect.map((data) => {
        const { severity, status, description } = this.aggregate(data.data);
        return {
          severity,
          status,
          description,
          updated_at: Date.now(),
          timezone: "UTC",
        };
      }),
    );
  }

  private aggregate(monitors: Monitor[]): {
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
          total === 1
            ? "1 monitor down (1 total)"
            : `All ${total} monitors down`,
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
