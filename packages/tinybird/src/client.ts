import { Tinybird as Client } from "@chronark/zod-bird";
import { z } from "zod";
import {
  tbBuildHomeStats,
  tbBuildMonitorList,
  tbBuildPublicStatus,
  tbParameterHomeStats,
  tbParameterMonitorList,
  tbParameterPublicStatus,
} from "./validation";
import { flyRegions } from "../../db/src/schema/constants";
import {
  headersSchema,
  httpTimingSchema,
  timingSchema,
  triggers,
} from "./schema";

/**
 * @deprecated but still used in server
 */
export function getMonitorList(tb: Client) {
  return tb.buildPipe({
    pipe: "status_timezone__v1",
    parameters: tbParameterMonitorList,
    data: tbBuildMonitorList,
    opts: {
      // cache: "no-store",
      next: {
        revalidate: 600, // 10 min cache
      },
    },
  });
}

/**
 * Homepage stats used for our marketing page
 */
export function getHomeStats(tb: Client) {
  return tb.buildPipe({
    pipe: "home_stats__v0",
    parameters: tbParameterHomeStats,
    data: tbBuildHomeStats,
    opts: {
      next: {
        revalidate: 43200, // 60 * 60 * 24 = 86400s = 12h
      },
    },
  });
}

export function getPublicStatus(tb: Client) {
  return tb.buildPipe({
    pipe: "public_status__v0",
    parameters: tbParameterPublicStatus,
    data: tbBuildPublicStatus,
  });
}

/**
 * LEARNINGS AND FINDINGS FOR LATER
 * - the `interval` makes it impossible to aggregate the data in tb
 *   this will allow us to even more reduce processed data
 * - TCP endpoints only have biweekly data as of now
 */

export class OSTinybird {
  private readonly tb: Client;

  constructor(token: string) {
    this.tb = new Client({ token });
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
        p50Latency: z.number(),
        p75Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
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
        p50Latency: z.number(),
        p75Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
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
        p50Latency: z.number(),
        p75Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
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
        p50Latency: z.number(),
        p75Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
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
        p50Latency: z.number(),
        p75Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
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
        p50Latency: z.number(),
        p75Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
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
        p50Latency: z.number(),
        p75Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
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
        p50Latency: z.number(),
        p75Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
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
        p50Latency: z.number(),
        p75Latency: z.number(),
        p90Latency: z.number(),
        p95Latency: z.number(),
        p99Latency: z.number(),
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
      opts: { cache: "no-store" },
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
        timing: z
          .string()
          .nullable()
          .optional()
          .transform((val) => {
            if (!val) return null;
            const value = httpTimingSchema.safeParse(JSON.parse(val));
            if (value.success) return value.data;
            return null;
          }),
        // TODO: make sure to include all data!
      }),
      opts: { cache: "no-store" },
    });
  }
  // TODO: add tcpChartDaily, tcpChartWeekly
}
