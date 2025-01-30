import { Tinybird as Client, NoopTinybird } from "@chronark/zod-bird";
import { z } from "zod";
import { flyRegions } from "../../db/src/schema/constants";
import { headersSchema, timingSchema, triggers } from "./schema";

const PUBLIC_CACHE = 300; // 5 * 60 = 300s = 5m

export class OSTinybird {
  private readonly tb: Client;

  constructor(token: string) {
    if (process.env.NODE_ENV === "development") {
      this.tb = new NoopTinybird();
    } else {
      this.tb = new Client({ token });
    }
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

  public get httpListDaily() {
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
      opts: { cache: "no-store" },
    });
  }

  public get httpListWeekly() {
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
      opts: { cache: "no-store" },
    });
  }

  public get httpListBiweekly() {
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
      opts: { cache: "no-store" },
    });
  }

  public get httpMetricsDaily() {
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
      opts: { cache: "no-store" },
    });
  }

  public get httpMetricsWeekly() {
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
      opts: { cache: "no-store" },
    });
  }

  public get httpMetricsBiweekly() {
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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

  public get tcpListDaily() {
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
      opts: { cache: "no-store" },
    });
  }

  public get tcpListWeekly() {
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
      opts: { cache: "no-store" },
    });
  }

  public get tcpListBiweekly() {
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
      opts: { cache: "no-store" },
    });
  }

  public get tcpMetricsDaily() {
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
      opts: { cache: "no-store" },
    });
  }

  public get tcpMetricsWeekly() {
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
      opts: { cache: "no-store" },
    });
  }

  public get tcpMetricsBiweekly() {
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "no-store" },
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
      opts: { cache: "force-cache" },
    });
  }
}
