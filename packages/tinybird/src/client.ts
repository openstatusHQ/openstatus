import { Tinybird as Client, NoopTinybird } from "@chronark/zod-bird";
import { z } from "zod";
import { flyRegions } from "../../db/src/schema/constants";
import {
  headersSchema,
  timingSchema,
  timingPhasesSchema,
  triggers,
} from "./schema";

const PUBLIC_CACHE = 300; // 5 * 60 = 300s = 5m
const DEV_CACHE = 10 * 60; // 10m
const REVALIDATE = process.env.NODE_ENV === "development" ? DEV_CACHE : 0;

export class OSTinybird {
  private readonly tb: Client;

  constructor(token: string) {
    // this.tb = new Client({ token });
    if (process.env.NODE_ENV === "development") {
      this.tb = new NoopTinybird();
    } else {
    }
    this.tb = new Client({ token });
  }

  public get homeStats() {
    return this.tb.buildPipe({
      pipe: "endpoint__stats_global__v0",
      parameters: z.object({
        cronTimestamp: z.number().int().optional(),
        period: z.enum(["total", "1h", "10m", "1d", "1w", "1m"]).optional(),
      }),
      data: z.object({
        count: z.number().int(),
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
        type: z.literal("http").default("http"),
        latency: z.number().int(),
        statusCode: z.number().int().nullable(),
        monitorId: z.string(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        fromDate: z.number().int().optional(),
        toDate: z.number().int().optional(),
      }),
      data: z.object({
        type: z.literal("http").default("http"),
        id: z.string().nullable(),
        latency: z.number().int(),
        statusCode: z.number().int().nullable(),
        monitorId: z.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        type: z.literal("http").default("http"),
        latency: z.number().int(),
        statusCode: z.number().int().nullable(),
        monitorId: z.string(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        fromDate: z.number().int().optional(),
        toDate: z.number().int().optional(),
      }),
      data: z.object({
        type: z.literal("http").default("http"),
        id: z.string().nullable(),
        latency: z.number().int(),
        statusCode: z.number().int().nullable(),
        monitorId: z.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        type: z.literal("http").default("http"),
        latency: z.number().int(),
        statusCode: z.number().int().nullable(),
        monitorId: z.string(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        fromDate: z.number().int().optional(),
        toDate: z.number().int().optional(),
      }),
      data: z.object({
        type: z.literal("http").default("http"),
        id: z.string().nullable(),
        latency: z.number().int(),
        statusCode: z.number().int().nullable(),
        monitorId: z.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int(),
        ok: z.number().int(),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_1d__v1",
      parameters: z.object({
        interval: z.number().int().optional(),
        regions: z.array(z.enum(flyRegions)).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int().default(0),
        success: z.number().int().default(0),
        degraded: z.number().int().default(0),
        error: z.number().int().default(0),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_httpMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_7d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int(),
        ok: z.number().int(),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_7d__v1",
      parameters: z.object({
        interval: z.number().int().optional(),
        regions: z.array(z.enum(flyRegions)).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int().default(0),
        success: z.number().int().default(0),
        degraded: z.number().int().default(0),
        error: z.number().int().default(0),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_httpMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_14d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int(),
        ok: z.number().int(),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_14d__v1",
      parameters: z.object({
        interval: z.number().int().optional(),
        regions: z.array(z.enum(flyRegions)).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int().default(0),
        success: z.number().int().default(0),
        degraded: z.number().int().default(0),
        error: z.number().int().default(0),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByIntervalDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_interval_1d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        timestamp: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByIntervalWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_interval_7d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        timestamp: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByIntervalBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_interval_14d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        timestamp: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByRegionDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_region_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        count: z.number().int(),
        ok: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByRegionWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_region_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        count: z.number().int(),
        ok: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsByRegionBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_by_region_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        count: z.number().int(),
        ok: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
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
        count: z.number().default(0),
        ok: z.number().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpStatus45d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_status_45d__v0",
      parameters: z.object({
        monitorId: z.string(),
        days: z.number().int().max(45).optional(),
      }),
      data: z.object({
        day: z.string().transform((val) => {
          // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
          return new Date(`${val} GMT`).toISOString();
        }),
        count: z.number().default(0),
        ok: z.number().default(0),
      }),
      opts: {
        next: {
          revalidate: PUBLIC_CACHE,
        },
      },
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
        type: z.literal("http").default("http"),
        latency: z.number().int(),
        statusCode: z.number().int().nullable(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        monitorId: z.string(),
        url: z.string().url(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        message: z.string().nullable(),
        headers: headersSchema,
        timing: timingPhasesSchema,
        assertions: z.string().nullable(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
      }),
      data: z.object({
        type: z.literal("http").default("http"),
        latency: z.number().int(),
        statusCode: z.number().int().nullable(),
        monitorId: z.string(),
        url: z.string().url(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        message: z.string().nullable(),
        headers: headersSchema,
        timing: timingSchema,
        assertions: z.string().nullable(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        monitorId: z.number().int(),
        timestamp: z.number(),
        url: z.string(),
      }),
      data: z.object({
        latency: z.number().int(), // in ms
        statusCode: z.number().int().nullable().default(null),
        monitorId: z.string().default(""),
        url: z.string().url().optional(),
        error: z
          .number()
          .default(0)
          .transform((val) => val !== 0),
        region: z.enum(flyRegions),
        timestamp: z.number().int().optional(),
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
        type: z.literal("tcp").default("tcp"),
        latency: z.number().int(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        fromDate: z.number().int().optional(),
        toDate: z.number().int().optional(),
      }),
      data: z.object({
        type: z.literal("tcp").default("tcp"),
        id: z.string().nullable(),
        latency: z.number().int(),
        monitorId: z.coerce.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        type: z.literal("tcp").default("tcp"),
        latency: z.number().int(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        fromDate: z.number().int().optional(),
        toDate: z.number().int().optional(),
      }),
      data: z.object({
        type: z.literal("tcp").default("tcp"),
        id: z.string().nullable(),
        latency: z.number().int(),
        monitorId: z.coerce.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        type: z.literal("tcp").default("tcp"),
        latency: z.number().int(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        fromDate: z.number().int().optional(),
        toDate: z.number().int().optional(),
      }),
      data: z.object({
        type: z.literal("tcp").default("tcp"),
        id: z.string().nullable(),
        latency: z.number().int(),
        monitorId: z.coerce.string(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
        timestamp: z.number(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_tcpMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_1d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int(),
        ok: z.number().int(),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_1d__v1",
      parameters: z.object({
        interval: z.number().int().optional(),
        regions: z.array(z.enum(flyRegions)).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int().default(0),
        success: z.number().int().default(0),
        degraded: z.number().int().default(0),
        error: z.number().int().default(0),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_tcpMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_7d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int(),
        ok: z.number().int(),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_7d__v1",
      parameters: z.object({
        interval: z.number().int().optional(),
        regions: z.array(z.enum(flyRegions)).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int().default(0),
        success: z.number().int().default(0),
        degraded: z.number().int().default(0),
        error: z.number().int().default(0),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get legacy_tcpMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_14d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int(),
        ok: z.number().int(),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_14d__v1",
      parameters: z.object({
        interval: z.number().int().optional(),
        regions: z.array(z.enum(flyRegions)).optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
        count: z.number().int().default(0),
        success: z.number().int().default(0),
        degraded: z.number().int().default(0),
        error: z.number().int().default(0),
        lastTimestamp: z.number().int().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByIntervalDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_interval_1d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        timestamp: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByIntervalWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_interval_7d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        timestamp: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByIntervalBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_interval_14d__v0",
      parameters: z.object({
        interval: z.number().int().optional(),
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        timestamp: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByRegionDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_region_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        count: z.number().int(),
        ok: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByRegionWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_region_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        count: z.number().int(),
        ok: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpMetricsByRegionBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_region_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        count: z.number().int(),
        ok: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
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
        count: z.number().default(0),
        ok: z.number().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpStatus45d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_status_45d__v0",
      parameters: z.object({
        monitorId: z.string(),
        days: z.number().int().max(45).optional(),
      }),
      data: z.object({
        day: z.string().transform((val) => {
          // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
          return new Date(`${val} GMT`).toISOString();
        }),
        count: z.number().default(0),
        ok: z.number().default(0),
      }),
      opts: {
        next: {
          revalidate: PUBLIC_CACHE,
        },
      },
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
        type: z.literal("tcp").default("tcp"),
        id: z.string().nullable(),
        uri: z.string(),
        latency: z.number().int(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
      }),
      data: z.object({
        type: z.literal("tcp").default("tcp"),
        latency: z.number().int(),
        monitorId: z.string(),
        error: z.coerce.boolean(),
        region: z.enum(flyRegions),
        cronTimestamp: z.number().int(),
        trigger: z.enum(triggers).nullable().default("cron"),
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
        interval: z.number().int().optional(),
        // Comma-separated list of regions, e.g. "ams,fra". Keeping string to pass directly.
        regions: z.string().array().optional(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        timestamp: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsRegionsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_regions_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.number().int().optional(),
        regions: z.string().array().optional(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        timestamp: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpMetricsRegionsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_regions_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.number().int().optional(),
        regions: z.string().array().optional(),
      }),
      data: z.object({
        region: z.enum(flyRegions),
        timestamp: z.number().int(),
        p50Latency: z.number().nullable().default(0),
        p75Latency: z.number().nullable().default(0),
        p90Latency: z.number().nullable().default(0),
        p95Latency: z.number().nullable().default(0),
        p99Latency: z.number().nullable().default(0),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpUptime30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_uptime_30d__v1",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        regions: z.enum(flyRegions).array().optional(),
        interval: z.number().int().optional(),
      }),
      data: z.object({
        interval: z.coerce.date(),
        success: z.number().int(),
        degraded: z.number().int(),
        error: z.number().int(),
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
        regions: z.enum(flyRegions).array().optional(),
        interval: z.number().int().optional(),
      }),
      data: z.object({
        interval: z.coerce.date(),
        success: z.number().int(),
        degraded: z.number().int(),
        error: z.number().int(),
      }),
    });
  }

  public get getAuditLog() {
    return this.tb.buildPipe({
      pipe: "endpoint__audit_log__v1",
      parameters: z.object({
        monitorId: z.string(),
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
        timestamp: z.number().int(),
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
        minLatency: z.number().int(),
        maxLatency: z.number().int(),
        p50Latency: z.number().int(),
        p75Latency: z.number().int(),
        p90Latency: z.number().int(),
        p95Latency: z.number().int(),
        p99Latency: z.number().int(),
        count: z.number().int(),
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
        minLatency: z.number().int(),
        maxLatency: z.number().int(),
        p50Latency: z.number().int(),
        p75Latency: z.number().int(),
        p90Latency: z.number().int(),
        p95Latency: z.number().int(),
        p99Latency: z.number().int(),
        count: z.number().int(),
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
        interval: z.number().int().optional(),
        regions: z.array(z.enum(flyRegions)).optional(),
      }),
      data: z.object({
        timestamp: z.number().int(),
        p50Dns: z.number().int(),
        p50Ttfb: z.number().int(),
        p50Transfer: z.number().int(),
        p50Connect: z.number().int(),
        p50Tls: z.number().int(),
        p75Dns: z.number().int(),
        p75Ttfb: z.number().int(),
        p75Transfer: z.number().int(),
        p75Connect: z.number().int(),
        p75Tls: z.number().int(),
        p90Dns: z.number().int(),
        p90Ttfb: z.number().int(),
        p90Transfer: z.number().int(),
        p90Connect: z.number().int(),
        p90Tls: z.number().int(),
        p95Dns: z.number().int(),
        p95Ttfb: z.number().int(),
        p95Transfer: z.number().int(),
        p95Connect: z.number().int(),
        p95Tls: z.number().int(),
        p99Dns: z.number().int(),
        p99Ttfb: z.number().int(),
        p99Transfer: z.number().int(),
        p99Connect: z.number().int(),
        p99Tls: z.number().int(),
      }),
    });
  }

  public get httpMetricsLatency1d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_latency_1d__v1",
      parameters: z.object({
        monitorId: z.string(),
      }),
      data: z.object({
        timestamp: z.number().int(),
        p50Latency: z.number().int(),
        p75Latency: z.number().int(),
        p90Latency: z.number().int(),
        p95Latency: z.number().int(),
        p99Latency: z.number().int(),
      }),
    });
  }

  public get tcpMetricsLatency1d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_latency_1d__v1",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(flyRegions)).optional(),
      }),
      data: z.object({
        timestamp: z.number().int(),
        p50Latency: z.number().int(),
        p75Latency: z.number().int(),
        p90Latency: z.number().int(),
        p95Latency: z.number().int(),
        p99Latency: z.number().int(),
      }),
    });
  }
}
