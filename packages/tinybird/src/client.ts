import { Tinybird as Client, NoopTinybird } from "@chronark/zod-bird";
import { z } from "zod";
import { monitorRegions } from "../../db/src/schema/constants";
import {
  headersSchema,
  timingPhasesSchema,
  timingSchema,
  triggers,
} from "./schema";

const PUBLIC_CACHE = 300; // 5 * 60 = 300s = 5m
const DEV_CACHE = 10 * 60; // 10m
const REVALIDATE = process.env.NODE_ENV === "development" ? DEV_CACHE : 0;

export class OSTinybird {
  private readonly tb: Client;

  constructor(token: string) {
    if (process.env.NODE_ENV === "development") {
      this.tb = new NoopTinybird();
    } else {
      // Use local Tinybird container if available (Docker/self-hosted)
      // https://www.tinybird.co/docs/api-reference
      const tinybirdUrl = process.env.TINYBIRD_URL || "https://api.tinybird.co";
      this.tb = new Client({
        token,
        baseUrl: tinybirdUrl,
      });
    }
  }

  public get homeStats() {
    return this.tb.buildPipe({
      pipe: "endpoint__stats_global__v0",
      parameters: z.object({
        cronTimestamp: z.int().optional(),
        period: z.enum(["total", "1h", "10m", "1d", "1w", "1m"]).optional(),
      }),
      data: z.object({
        count: z.int(),
      }),
      // REMINDER: cache on build time as it's a global stats
      opts: { cache: "force-cache" },
    });
  }

  public get legacy_httpListDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("http").prefault("http"),
        latency: z.int(),
        statusCode: z.int().nullable(),
        monitorId: z.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        workspaceId: z.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpListDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_1d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("http").prefault("http"),
        id: z.string().nullable(),
        latency: z.int(),
        statusCode: z.int().nullable(),
        monitorId: z.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        timing: timingPhasesSchema,
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_httpListWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("http").prefault("http"),
        latency: z.int(),
        statusCode: z.int().nullable(),
        monitorId: z.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        workspaceId: z.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpListWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_7d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("http").prefault("http"),
        id: z.string().nullable(),
        latency: z.int(),
        statusCode: z.int().nullable(),
        monitorId: z.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        timing: timingPhasesSchema,
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_httpListBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("http").prefault("http"),
        latency: z.int(),
        statusCode: z.int().nullable(),
        monitorId: z.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        workspaceId: z.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpListBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_14d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("http").prefault("http"),
        id: z.string().nullable(),
        latency: z.int(),
        statusCode: z.int().nullable(),
        monitorId: z.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        timing: timingPhasesSchema,
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_httpMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_1d__v0",
      parameters: z.object({
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int(),
        ok: z.int(),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_1d__v1",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int().prefault(0),
        success: z.int().prefault(0),
        degraded: z.int().prefault(0),
        error: z.int().prefault(0),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_httpMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_7d__v0",
      parameters: z.object({
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int(),
        ok: z.int(),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_7d__v1",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int().prefault(0),
        success: z.int().prefault(0),
        degraded: z.int().prefault(0),
        error: z.int().prefault(0),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_httpMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_14d__v0",
      parameters: z.object({
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int(),
        ok: z.int(),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_14d__v1",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int().prefault(0),
        success: z.int().prefault(0),
        degraded: z.int().prefault(0),
        error: z.int().prefault(0),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByIntervalDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_interval_1d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByIntervalWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_interval_7d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByIntervalBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_interval_14d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByRegionDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_region_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        count: z.int(),
        ok: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByRegionWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_region_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        count: z.int(),
        ok: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByRegionBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_region_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        count: z.int(),
        ok: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpStatusWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_status_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        day: z.string().transform((val) => {
          // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
          return new Date(`${val} GMT`).toISOString();
        }),
        count: z.number().prefault(0),
        ok: z.number().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_httpStatus45d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_status_45d__v0",
      parameters: z.object({
        monitorId: z.string(),
        days: z.int().max(45).optional(),
      }),
      data: z.object({
        day: z.string().transform((val) => {
          // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
          return new Date(`${val} GMT`).toISOString();
        }),
        count: z.number().prefault(0),
        ok: z.number().prefault(0),
      }),
      opts: {
        next: {
          revalidate: PUBLIC_CACHE,
        },
      },
    });
  }

  public get httpStatus45d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_status_45d__v1",
      parameters: z.object({
        monitorIds: z.string().array(),
      }),
      data: z.object({
        day: z.string().transform((val) => {
          // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
          return new Date(`${val} GMT`).toISOString();
        }),
        count: z.number().prefault(0),
        ok: z.number().prefault(0),
        degraded: z.number().prefault(0),
        error: z.number().prefault(0),
        monitorId: z.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpGetBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_get_14d__v0",
      parameters: z.object({
        id: z.string().nullable(),
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("http").prefault("http"),
        latency: z.int(),
        statusCode: z.int().nullable(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        monitorId: z.string(),
        url: z.url(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        message: z.string().nullable(),
        headers: headersSchema,
        timing: timingPhasesSchema,
        assertions: z.string().nullable(),
        body: z.string().nullable(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        workspaceId: z.string(),
        id: z.string().nullable(),
      }),
      // REMINDER: cache the result for accessing the data for a check as it won't change
      opts: { cache: "force-cache" },
    });
  }

  public get httpGetMonthly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_get_30d__v0",
      parameters: z.object({
        monitorId: z.string(),
        region: z.enum(monitorRegions).or(z.string()).optional(),
        cronTimestamp: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("http").prefault("http"),
        latency: z.int(),
        statusCode: z.int().nullable(),
        monitorId: z.string(),
        url: z.url(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        message: z.string().nullable(),
        headers: headersSchema,
        timing: timingSchema,
        assertions: z.string().nullable(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        workspaceId: z.string(),
      }),
      // REMINDER: cache the result for accessing the data for a check as it won't change
      opts: { cache: "force-cache" },
    });
  }

  // FIXME: rename to same convension
  public get getResultForOnDemandCheckHttp() {
    return this.tb.buildPipe({
      pipe: "get_result_for_on_demand_check_http",
      parameters: z.object({
        monitorId: z.int(),
        timestamp: z.number(),
        url: z.string(),
      }),
      data: z.object({
        latency: z.int(), // in ms
        statusCode: z.int().nullable().prefault(null),
        monitorId: z.string().prefault(""),
        url: z.url().optional(),
        error: z
          .number()
          .prefault(0)
          .transform((val) => val !== 0),
        region: z.enum(monitorRegions),
        timestamp: z.int().optional(),
        message: z.string().nullable().optional(),
        timing: timingSchema,
        // TODO: make sure to include all data!
      }),
      opts: { cache: "no-store" },
    });
  }
  // TODO: add tcpChartDaily, tcpChartWeekly

  public get legacy_tcpListDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("tcp").prefault("tcp"),
        latency: z.int(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        workspaceId: z.coerce.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpListDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_1d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("tcp").prefault("tcp"),
        id: z.string().nullable(),
        latency: z.int(),
        monitorId: z.coerce.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_tcpListWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("tcp").prefault("tcp"),
        latency: z.int(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        workspaceId: z.coerce.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpListWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_7d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("tcp").prefault("tcp"),
        id: z.string().nullable(),
        latency: z.int(),
        monitorId: z.coerce.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_tcpListBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("tcp").prefault("tcp"),
        latency: z.int(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        workspaceId: z.coerce.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpListBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_14d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("tcp").prefault("tcp"),
        id: z.string().nullable(),
        latency: z.int(),
        monitorId: z.coerce.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_tcpMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_1d__v0",
      parameters: z.object({
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int(),
        ok: z.int(),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_1d__v1",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int().prefault(0),
        success: z.int().prefault(0),
        degraded: z.int().prefault(0),
        error: z.int().prefault(0),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_tcpMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_7d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int(),
        ok: z.int(),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_7d__v1",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int().prefault(0),
        success: z.int().prefault(0),
        degraded: z.int().prefault(0),
        error: z.int().prefault(0),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_tcpMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_14d__v0",
      parameters: z.object({
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int(),
        ok: z.int(),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_14d__v1",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int().prefault(0),
        success: z.int().prefault(0),
        degraded: z.int().prefault(0),
        error: z.int().prefault(0),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByIntervalDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_interval_1d__v0",
      parameters: z.object({
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByIntervalWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_interval_7d__v0",
      parameters: z.object({
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByIntervalBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_interval_14d__v0",
      parameters: z.object({
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        interval: z.int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByRegionDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_region_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        count: z.int(),
        ok: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByRegionWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_region_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        count: z.int(),
        ok: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByRegionBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_region_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        count: z.int(),
        ok: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpStatusWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_status_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        day: z.string().transform((val) => {
          // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
          return new Date(`${val} GMT`).toISOString();
        }),
        count: z.number().prefault(0),
        ok: z.number().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_tcpStatus45d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_status_45d__v0",
      parameters: z.object({
        monitorId: z.string(),
        days: z.int().max(45).optional(),
      }),
      data: z.object({
        day: z.string().transform((val) => {
          // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
          return new Date(`${val} GMT`).toISOString();
        }),
        count: z.number().prefault(0),
        ok: z.number().prefault(0),
      }),
      opts: {
        next: {
          revalidate: PUBLIC_CACHE,
        },
      },
    });
  }

  public get tcpStatus45d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_status_45d__v1",
      parameters: z.object({
        monitorIds: z.string().array(),
        days: z.int().max(45).optional(),
      }),
      data: z.object({
        day: z.string().transform((val) => {
          // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
          return new Date(`${val} GMT`).toISOString();
        }),
        count: z.number().prefault(0),
        ok: z.number().prefault(0),
        degraded: z.number().prefault(0),
        error: z.number().prefault(0),
        monitorId: z.coerce.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpWorkspace30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_workspace_30d__v0",
      parameters: z.object({
        workspaceId: z.string(),
      }),
      data: z.object({
        day: z
          .string()
          .transform((val) => new Date(`${val} GMT`).toISOString()),
        count: z.int(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpWorkspace30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_workspace_30d__v0",
      parameters: z.object({
        workspaceId: z.string(),
      }),
      data: z.object({
        day: z
          .string()
          .transform((val) => new Date(`${val} GMT`).toISOString()),
        count: z.int(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpGetBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_get_14d__v0",
      parameters: z.object({
        id: z.string().nullable(),
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("tcp").prefault("tcp"),
        id: z.string().nullable(),
        uri: z.string(),
        latency: z.int(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        errorMessage: z.string().nullable(),
      }),
      // REMINDER: cache the result for accessing the data for a check as it won't change
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpGetMonthly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_get_30d__v0",
      parameters: z.object({
        monitorId: z.string(),
        region: z.enum(monitorRegions).or(z.string()).optional(),
        cronTimestamp: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("tcp").prefault("tcp"),
        latency: z.int(),
        monitorId: z.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        workspaceId: z.string(),
      }),
      // REMINDER: cache the result for accessing the data for a check as it won't change
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  /**
   * Region + timestamp metrics (quantiles) – aggregated by interval.
   * NOTE: The Tinybird pipe returns one row per region & interval with latency quantiles.
   */
  public get httpMetricsRegionsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_regions_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().optional(),
        // Comma-separated list of regions, e.g. "ams,fra". Keeping string to pass directly.
        regions: z.string().array().optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsRegionsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_regions_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().optional(),
        regions: z.string().array().optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsRegionsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_regions_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().optional(),
        regions: z.string().array().optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpUptimeWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_uptime_7d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        regions: z.enum(monitorRegions).or(z.string()).array().optional(),
        interval: z.int().optional(),
      }),
      data: z.object({
        interval: z.coerce.date(),
        success: z.int(),
        degraded: z.int(),
        error: z.int(),
      }),
    });
  }

  public get httpUptime30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_uptime_30d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        regions: z.enum(monitorRegions).or(z.string()).array().optional(),
        interval: z.int().optional(),
      }),
      data: z.object({
        interval: z.coerce.date(),
        success: z.int(),
        degraded: z.int(),
        error: z.int(),
      }),
    });
  }

  public get tcpUptimeWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_uptime_7d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        regions: z.enum(monitorRegions).or(z.string()).array().optional(),
        interval: z.int().optional(),
      }),
      data: z.object({
        interval: z.coerce.date(),
        success: z.int(),
        degraded: z.int(),
        error: z.int(),
      }),
    });
  }

  public get tcpUptime30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_uptime_30d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        regions: z.enum(monitorRegions).or(z.string()).array().optional(),
        interval: z.int().optional(),
      }),
      data: z.object({
        interval: z.coerce.date(),
        success: z.int(),
        degraded: z.int(),
        error: z.int(),
      }),
    });
  }

  public get getAuditLog() {
    return this.tb.buildPipe({
      pipe: "endpoint__audit_log__v1",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().prefault(30), // in days
      }),
      data: z.object({
        action: z.string(),
        id: z.string(),
        metadata: z.string().transform((str) => {
          try {
            return JSON.parse(str) as Record<string, unknown>;
          } catch (error) {
            console.error(error);
            return {};
          }
        }),
        timestamp: z.int(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpGlobalMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_global_1d__v0",
      parameters: z.object({
        monitorIds: z.string().array(),
      }),
      data: z.object({
        minLatency: z.int(),
        maxLatency: z.int(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
        lastTimestamp: z.int(),
        count: z.int(),
        monitorId: z.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpGlobalMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_global_1d__v0",
      parameters: z.object({
        monitorIds: z.string().array(),
      }),
      data: z.object({
        minLatency: z.int(),
        maxLatency: z.int(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
        lastTimestamp: z.int(),
        count: z.int(),
        monitorId: z.coerce.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpTimingPhases14d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_timing_phases_14d__v1",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        p50Dns: z.int(),
        p50Ttfb: z.int(),
        p50Transfer: z.int(),
        p50Connect: z.int(),
        p50Tls: z.int(),
        p75Dns: z.int(),
        p75Ttfb: z.int(),
        p75Transfer: z.int(),
        p75Connect: z.int(),
        p75Tls: z.int(),
        p90Dns: z.int(),
        p90Ttfb: z.int(),
        p90Transfer: z.int(),
        p90Connect: z.int(),
        p90Tls: z.int(),
        p95Dns: z.int(),
        p95Ttfb: z.int(),
        p95Transfer: z.int(),
        p95Connect: z.int(),
        p95Tls: z.int(),
        p99Dns: z.int(),
        p99Ttfb: z.int(),
        p99Transfer: z.int(),
        p99Connect: z.int(),
        p99Tls: z.int(),
      }),
    });
  }

  public get httpMetricsLatency1d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_latency_1d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
      }),
    });
  }

  public get httpMetricsLatency7d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_latency_7d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
      }),
    });
  }

  public get httpMetricsLatency1dMulti() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_latency_1d_multi__v1",
      parameters: z.object({
        monitorIds: z.string().array().min(1),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        monitorId: z.string(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsLatency1d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_latency_1d__v1",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
      }),
    });
  }

  public get tcpMetricsLatency7d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_latency_7d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
      }),
    });
  }

  public get tcpMetricsLatency1dMulti() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_latency_1d_multi__v1",
      parameters: z.object({
        monitorIds: z.string().array().min(1),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        monitorId: z.coerce.string(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsGetBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_get_14d__v0",
      parameters: z.object({
        id: z.string().nullable(),
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("dns").prefault("dns"),
        id: z.coerce.string().nullable(),
        uri: z.string(),
        latency: z.int(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        errorMessage: z.string().nullable(),
        assertions: z.string().nullable(),
        records: z
          .string()
          .transform((str) => {
            try {
              return JSON.parse(str) as Record<string, unknown>;
            } catch (error) {
              console.error(error);
              return {};
            }
          })
          .pipe(z.record(z.string(), z.array(z.string()))),
      }),
      // REMINDER: cache the result for accessing the data for a check as it won't change
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsListBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_list_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("dns").prefault("dns"),
        id: z.coerce.string().nullable(),
        uri: z.string(),
        latency: z.int(),
        monitorId: z.coerce.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        records: z
          .string()
          .transform((str) => {
            try {
              return JSON.parse(str) as Record<string, unknown>;
            } catch (error) {
              console.error(error);
              return {};
            }
          })
          .pipe(z.record(z.string(), z.array(z.string()))),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_1d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int().prefault(0),
        success: z.int().prefault(0),
        degraded: z.int().prefault(0),
        error: z.int().prefault(0),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_7d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int().prefault(0),
        success: z.int().prefault(0),
        degraded: z.int().prefault(0),
        error: z.int().prefault(0),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_14d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
        count: z.int().prefault(0),
        success: z.int().prefault(0),
        degraded: z.int().prefault(0),
        error: z.int().prefault(0),
        lastTimestamp: z.int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsUptime30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_uptime_30d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        regions: z.enum(monitorRegions).or(z.string()).array().optional(),
        interval: z.int().optional(),
      }),
      data: z.object({
        interval: z.coerce.date(),
        success: z.int(),
        degraded: z.int(),
        error: z.int(),
      }),
    });
  }

  public get dnsMetricsLatency7d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_latency_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
      }),
    });
  }

  public get dnsMetricsRegionsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_regions_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().optional(),
        // Comma-separated list of regions, e.g. "ams,fra". Keeping string to pass directly.
        regions: z.string().array().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: z.object({
        region: z.enum(monitorRegions).or(z.string()),
        timestamp: z.int(),
        p50Latency: z.number().nullable().prefault(0),
        p75Latency: z.number().nullable().prefault(0),
        p90Latency: z.number().nullable().prefault(0),
        p95Latency: z.number().nullable().prefault(0),
        p99Latency: z.number().nullable().prefault(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsStatus45d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_status_45d__v0",
      parameters: z.object({
        monitorIds: z.string().array(),
      }),
      data: z.object({
        day: z.string().transform((val) => {
          // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
          return new Date(`${val} GMT`).toISOString();
        }),
        count: z.number().prefault(0),
        ok: z.number().prefault(0),
        degraded: z.number().prefault(0),
        error: z.number().prefault(0),
        monitorId: z.coerce.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsMetricsLatency1dMulti() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_latency_1d_multi__v0",
      parameters: z.object({
        monitorIds: z.string().array().min(1),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        monitorId: z.coerce.string(),
        p50Latency: z.int(),
        p75Latency: z.int(),
        p90Latency: z.int(),
        p95Latency: z.int(),
        p99Latency: z.int(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }
}
