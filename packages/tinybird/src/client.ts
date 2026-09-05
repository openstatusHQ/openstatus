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

// Daily-aggregate columns shared by the external-status history pipes (page-
// level and per-component). One shape so the `day` GMT-parse can't drift.
const externalStatusHistoryDailyShape = {
  day: z.string().transform((val) => new Date(`${val} GMT`).toISOString()),
  worst_indicator: z.string(),
  had_maintenance: z.int(),
  snapshot_count: z.int(),
};

const icmpMetricsShape = z.object({
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
});

const icmpMetricsByIntervalParameters = z.object({
  regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
  interval: z.int().optional(),
  monitorId: z.string(),
});

const icmpMetricsByIntervalShape = z.object({
  region: z.enum(monitorRegions).or(z.string()),
  timestamp: z.int(),
  p50Latency: z.number().nullable().prefault(0),
  p75Latency: z.number().nullable().prefault(0),
  p90Latency: z.number().nullable().prefault(0),
  p95Latency: z.number().nullable().prefault(0),
  p99Latency: z.number().nullable().prefault(0),
});

const icmpMetricsByRegionParameters = z.object({
  monitorId: z.string(),
  regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
});

const icmpMetricsByRegionShape = z.object({
  region: z.enum(monitorRegions).or(z.string()),
  count: z.int(),
  ok: z.int(),
  p50Latency: z.number().nullable().prefault(0),
  p75Latency: z.number().nullable().prefault(0),
  p90Latency: z.number().nullable().prefault(0),
  p95Latency: z.number().nullable().prefault(0),
  p99Latency: z.number().nullable().prefault(0),
});

const icmpMetricsLatencyShape = z.object({
  timestamp: z.int(),
  p50Latency: z.int(),
  p75Latency: z.int(),
  p90Latency: z.int(),
  p95Latency: z.int(),
  p99Latency: z.int(),
});

const icmpUptimeParameters = z.object({
  monitorId: z.string(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  regions: z.enum(monitorRegions).or(z.string()).array().optional(),
  interval: z.int().optional(),
});

const icmpUptimeShape = z.object({
  interval: z.coerce.date(),
  success: z.int(),
  degraded: z.int(),
  error: z.int(),
});

// Row shapes shared by the v1 (offset) and v2 (cursor) list pipes of each job
// type — one object per type so the two generations cannot drift apart.
const httpListRowShape = {
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
};

const tcpListRowShape = {
  type: z.literal("tcp").prefault("tcp"),
  id: z.string().nullable(),
  latency: z.int(),
  monitorId: z.coerce.string(),
  requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
  region: z.enum(monitorRegions).or(z.string()),
  cronTimestamp: z.int(),
  trigger: z.enum(triggers).nullable().prefault("cron"),
  timestamp: z.number(),
};

const icmpListRowShape = {
  type: z.literal("icmp").prefault("icmp"),
  id: z.string().nullable(),
  latency: z.int(),
  latencyMin: z.int().prefault(0),
  latencyMax: z.int().prefault(0),
  packetsSent: z.int().prefault(0),
  packetsReceived: z.int().prefault(0),
  monitorId: z.coerce.string(),
  requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
  region: z.enum(monitorRegions).or(z.string()),
  cronTimestamp: z.int(),
  trigger: z.enum(triggers).nullable().prefault("cron"),
  timestamp: z.number(),
};

const dnsListRowShape = {
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
};

const grpcListRowShape = {
  type: z.literal("grpc").prefault("grpc"),
  id: z.string().nullable(),
  latency: z.int(),
  servingStatus: z.string().nullable(),
  grpcCode: z.int().nullable(),
  service: z.string().nullable(),
  monitorId: z.coerce.string(),
  requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
  region: z.enum(monitorRegions).or(z.string()),
  cronTimestamp: z.int(),
  trigger: z.enum(triggers).nullable().prefault("cron"),
  timestamp: z.number(),
  // gRPC is HTTP/2, so the checker writes HTTP's phase shape verbatim.
  timing: timingPhasesSchema,
};

// Filters every v2 list and facet pipe accepts; each maps to one `IN` or range
// predicate evaluated by Tinybird instead of the browser.
// Bounded here too: these are comma-joined into the pipe request's query string,
// so the ceiling has to hold at the boundary that builds the URL.
const responseLogFilterShape = {
  regions: z.array(z.string().max(64)).max(128).optional(),
  status: z.array(z.string().max(16)).max(3).optional(),
  trigger: z.array(z.string().max(16)).max(2).optional(),
  latencyMin: z.int().optional(),
  latencyMax: z.int().optional(),
};

const httpResponseLogFilterShape = {
  ...responseLogFilterShape,
  // `Array(statusCodes, 'Int16')` in the pipes: out of that range the query
  // errors instead of matching nothing.
  statusCodes: z.array(z.int().min(0).max(32_767)).max(100).optional(),
};

// The service overfetches by the monitor's location count on top of the caller's
// page size, so this ceiling sits well above the 100-row service maximum.
const listV2WindowShape = {
  monitorId: z.string(),
  fromDate: z.int().optional(),
  toDate: z.int().optional(),
  cursor: z.int().optional(),
  direction: z.enum(["next", "prev"]).prefault("next"),
  limit: z.int().min(1).max(1000),
};

const facetWindowShape = {
  monitorId: z.string(),
  fromDate: z.int().optional(),
  toDate: z.int().optional(),
};

const facetRowShape = {
  field: z.string(),
  value: z.string(),
  count: z.int(),
};

const grpcMetricsShape = z.object({
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
});

const grpcMetricsByIntervalParameters = z.object({
  regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
  interval: z.int().optional(),
  monitorId: z.string(),
});

const grpcMetricsByIntervalShape = z.object({
  region: z.enum(monitorRegions).or(z.string()),
  timestamp: z.int(),
  p50Latency: z.number().nullable().prefault(0),
  p75Latency: z.number().nullable().prefault(0),
  p90Latency: z.number().nullable().prefault(0),
  p95Latency: z.number().nullable().prefault(0),
  p99Latency: z.number().nullable().prefault(0),
});

const grpcMetricsByRegionParameters = z.object({
  monitorId: z.string(),
  regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
});

const grpcMetricsByRegionShape = z.object({
  region: z.enum(monitorRegions).or(z.string()),
  count: z.int(),
  ok: z.int(),
  p50Latency: z.number().nullable().prefault(0),
  p75Latency: z.number().nullable().prefault(0),
  p90Latency: z.number().nullable().prefault(0),
  p95Latency: z.number().nullable().prefault(0),
  p99Latency: z.number().nullable().prefault(0),
});

const grpcMetricsLatencyShape = z.object({
  timestamp: z.int(),
  p50Latency: z.int(),
  p75Latency: z.int(),
  p90Latency: z.int(),
  p95Latency: z.int(),
  p99Latency: z.int(),
});

const grpcUptimeParameters = z.object({
  monitorId: z.string(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  regions: z.enum(monitorRegions).or(z.string()).array().optional(),
  interval: z.int().optional(),
});

const grpcUptimeShape = z.object({
  interval: z.coerce.date(),
  success: z.int(),
  degraded: z.int(),
  error: z.int(),
});

export const TINYBIRD_DEFAULT_URL = "https://api.tinybird.co";

/**
 * A `TINYBIRD_NOOP` env value. Apps hand this over in two shapes: a real
 * boolean where the env schema validated it, a raw string where the schema ran
 * with `skipValidation` — and the string `"false"` is truthy, so it can never
 * be tested directly. Anything unset or unrecognised means disabled.
 */
export const noopFlagSchema = z.stringbool().or(z.boolean()).catch(false);

export type OSTinybirdConfig = {
  token: string;
  /** Instance to query. Callers pass their app's validated env value. */
  baseUrl?: string;
  /** Resolve every pipe and ingest to empty — tests and offline dev. */
  noop?: boolean | string;
};

export class OSTinybird {
  private readonly tb: Client;

  constructor(config: OSTinybirdConfig) {
    // Tests must never reach a real instance whatever token sits in the env —
    // checked here so no call site can forget it.
    const noop =
      process.env.NODE_ENV === "test" || noopFlagSchema.parse(config.noop);
    // An empty token cannot authenticate, so noop keeps pipes resolving empty
    // instead of throwing at every call site.
    if (noop || !config.token) {
      if (!noop) {
        console.warn(
          "[tinybird] no token configured — every pipe will return empty data",
        );
      }
      this.tb = new NoopTinybird();
    } else {
      this.tb = new Client({
        token: config.token,
        baseUrl: config.baseUrl || TINYBIRD_DEFAULT_URL,
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
      data: z.object(httpListRowShape),
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
      data: z.object(httpListRowShape),
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
        limit: z.int().optional(),
        offset: z.int().optional(),
      }),
      data: z.object(httpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpListV2Daily() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_1d__v2",
      parameters: z.object({
        ...listV2WindowShape,
        ...httpResponseLogFilterShape,
      }),
      data: z.object(httpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpListV2Weekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_7d__v2",
      parameters: z.object({
        ...listV2WindowShape,
        ...httpResponseLogFilterShape,
      }),
      data: z.object(httpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpListV2Biweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_14d__v2",
      parameters: z.object({
        ...listV2WindowShape,
        ...httpResponseLogFilterShape,
      }),
      data: z.object(httpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get httpListFacets() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_list_facets_14d__v0",
      parameters: z.object({
        ...facetWindowShape,
        ...httpResponseLogFilterShape,
      }),
      data: z.object(facetRowShape),
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
      data: z.object(tcpListRowShape),
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
      data: z.object(tcpListRowShape),
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
      data: z.object(tcpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpListV2Daily() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_1d__v2",
      parameters: z.object({
        ...listV2WindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(tcpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpListV2Weekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_7d__v2",
      parameters: z.object({
        ...listV2WindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(tcpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpListV2Biweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_14d__v2",
      parameters: z.object({
        ...listV2WindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(tcpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get tcpListFacets() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_list_facets_14d__v0",
      parameters: z.object({
        ...facetWindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(facetRowShape),
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

  public get icmpListDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_list_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object(icmpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpListWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_list_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object(icmpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpListBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_list_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object(icmpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpListV2Daily() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_list_1d__v1",
      parameters: z.object({
        ...listV2WindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(icmpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpListV2Weekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_list_7d__v1",
      parameters: z.object({
        ...listV2WindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(icmpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpListV2Biweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_list_14d__v1",
      parameters: z.object({
        ...listV2WindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(icmpListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpListFacets() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_list_facets_14d__v0",
      parameters: z.object({
        ...facetWindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(facetRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpGetBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_get_14d__v0",
      parameters: z.object({
        id: z.string().nullable(),
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("icmp").prefault("icmp"),
        id: z.string().nullable(),
        uri: z.string(),
        latency: z.int(),
        latencyMin: z.int().prefault(0),
        latencyMax: z.int().prefault(0),
        packetsSent: z.int().prefault(0),
        packetsReceived: z.int().prefault(0),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        errorMessage: z.string().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_1d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: icmpMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_7d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: icmpMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_14d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: icmpMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetrics30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_30d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: icmpMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetrics90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_90d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: icmpMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsByIntervalDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_by_interval_1d__v0",
      parameters: icmpMetricsByIntervalParameters,
      data: icmpMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsByIntervalWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_by_interval_7d__v0",
      parameters: icmpMetricsByIntervalParameters,
      data: icmpMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsByIntervalBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_by_interval_14d__v0",
      parameters: icmpMetricsByIntervalParameters,
      data: icmpMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsByInterval30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_by_interval_30d__v0",
      parameters: icmpMetricsByIntervalParameters,
      data: icmpMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsByInterval90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_by_interval_90d__v0",
      parameters: icmpMetricsByIntervalParameters,
      data: icmpMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsLatency1d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_latency_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: icmpMetricsLatencyShape,
    });
  }

  public get icmpMetricsLatency7d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_latency_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: icmpMetricsLatencyShape,
    });
  }

  public get icmpMetricsLatency30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_latency_30d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: icmpMetricsLatencyShape,
    });
  }

  public get icmpMetricsLatency90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_latency_90d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: icmpMetricsLatencyShape,
    });
  }

  public get icmpMetricsLatency1dMulti() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_latency_1d_multi__v0",
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

  public get icmpStatus45d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_status_45d__v0",
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

  public get icmpUptimeWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_uptime_7d__v0",
      parameters: icmpUptimeParameters,
      data: icmpUptimeShape,
    });
  }

  public get icmpUptime30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_uptime_30d__v0",
      parameters: icmpUptimeParameters,
      data: icmpUptimeShape,
    });
  }

  public get icmpUptime90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_uptime_90d__v0",
      parameters: icmpUptimeParameters,
      data: icmpUptimeShape,
    });
  }

  public get icmpGlobalMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_global_1d__v0",
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

  public get icmpWorkspace30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_workspace_30d__v0",
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

  public get icmpGetMonthly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_get_30d__v0",
      parameters: z.object({
        monitorId: z.string(),
        region: z.enum(monitorRegions).or(z.string()).optional(),
        cronTimestamp: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("icmp").prefault("icmp"),
        id: z.string().nullable(),
        uri: z.string(),
        latency: z.int(),
        latencyMin: z.int().prefault(0),
        latencyMax: z.int().prefault(0),
        packetsSent: z.int().prefault(0),
        packetsReceived: z.int().prefault(0),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        errorMessage: z.string().nullable(),
        workspaceId: z.coerce.string(),
      }),
      // REMINDER: cache the result for accessing the data for a check as it won't change
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpStatusWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_status_7d__v0",
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

  public get icmpMetricsByRegionDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_by_region_1d__v0",
      parameters: icmpMetricsByRegionParameters,
      data: icmpMetricsByRegionShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsByRegionWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_by_region_7d__v0",
      parameters: icmpMetricsByRegionParameters,
      data: icmpMetricsByRegionShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get icmpMetricsByRegionBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__icmp_metrics_by_region_14d__v0",
      parameters: icmpMetricsByRegionParameters,
      data: icmpMetricsByRegionShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcListDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_list_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("grpc").prefault("grpc"),
        id: z.string().nullable(),
        latency: z.int(),
        servingStatus: z.string().nullable(),
        grpcCode: z.int().nullable(),
        service: z.string().nullable(),
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

  public get grpcListWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_list_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("grpc").prefault("grpc"),
        id: z.string().nullable(),
        latency: z.int(),
        servingStatus: z.string().nullable(),
        grpcCode: z.int().nullable(),
        service: z.string().nullable(),
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

  public get grpcListBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_list_14d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.int().optional(),
        toDate: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("grpc").prefault("grpc"),
        id: z.string().nullable(),
        latency: z.int(),
        servingStatus: z.string().nullable(),
        grpcCode: z.int().nullable(),
        service: z.string().nullable(),
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

  public get grpcGetBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_get_14d__v0",
      parameters: z.object({
        id: z.string().nullable(),
        monitorId: z.string(),
      }),
      data: z.object({
        type: z.literal("grpc").prefault("grpc"),
        id: z.string().nullable(),
        uri: z.string(),
        latency: z.int(),
        servingStatus: z.string().nullable(),
        grpcCode: z.int().nullable(),
        service: z.string().nullable(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        errorMessage: z.string().nullable(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcListV2Biweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_list_14d__v1",
      parameters: z.object({
        ...listV2WindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(grpcListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcListFacets() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_list_facets_14d__v0",
      parameters: z.object({
        ...facetWindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(facetRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_1d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: grpcMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_7d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: grpcMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_14d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: grpcMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetrics30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_30d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: grpcMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetrics90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_90d__v0",
      parameters: z.object({
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        monitorId: z.string(),
      }),
      data: grpcMetricsShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsByIntervalDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_by_interval_1d__v0",
      parameters: grpcMetricsByIntervalParameters,
      data: grpcMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsByIntervalWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_by_interval_7d__v0",
      parameters: grpcMetricsByIntervalParameters,
      data: grpcMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsByIntervalBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_by_interval_14d__v0",
      parameters: grpcMetricsByIntervalParameters,
      data: grpcMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsByInterval30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_by_interval_30d__v0",
      parameters: grpcMetricsByIntervalParameters,
      data: grpcMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsByInterval90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_by_interval_90d__v0",
      parameters: grpcMetricsByIntervalParameters,
      data: grpcMetricsByIntervalShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsLatency1d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_latency_1d__v0",
      parameters: z.object({
        monitorId: z.string(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: grpcMetricsLatencyShape,
    });
  }

  public get grpcMetricsLatency7d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_latency_7d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: grpcMetricsLatencyShape,
    });
  }

  public get grpcMetricsLatency30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_latency_30d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: grpcMetricsLatencyShape,
    });
  }

  public get grpcMetricsLatency90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_latency_90d__v0",
      parameters: z.object({
        monitorId: z.string(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      data: grpcMetricsLatencyShape,
    });
  }

  public get grpcMetricsLatency1dMulti() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_latency_1d_multi__v0",
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

  public get grpcStatus45d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_status_45d__v0",
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

  public get grpcUptimeWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_uptime_7d__v0",
      parameters: grpcUptimeParameters,
      data: grpcUptimeShape,
    });
  }

  public get grpcUptime30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_uptime_30d__v0",
      parameters: grpcUptimeParameters,
      data: grpcUptimeShape,
    });
  }

  public get grpcUptime90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_uptime_90d__v0",
      parameters: grpcUptimeParameters,
      data: grpcUptimeShape,
    });
  }

  public get grpcGlobalMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_global_1d__v0",
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

  public get grpcWorkspace30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_workspace_30d__v0",
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

  public get grpcGetMonthly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_get_30d__v0",
      parameters: z.object({
        monitorId: z.string(),
        region: z.enum(monitorRegions).or(z.string()).optional(),
        cronTimestamp: z.int().optional(),
      }),
      data: z.object({
        type: z.literal("grpc").prefault("grpc"),
        id: z.string().nullable(),
        uri: z.string(),
        latency: z.int(),
        servingStatus: z.string().nullable(),
        grpcCode: z.int().nullable(),
        service: z.string().nullable(),
        monitorId: z.coerce.string(),
        error: z.coerce.boolean(),
        region: z.enum(monitorRegions).or(z.string()),
        cronTimestamp: z.int(),
        trigger: z.enum(triggers).nullable().prefault("cron"),
        timestamp: z.number(),
        requestStatus: z.enum(["error", "success", "degraded"]).nullable(),
        errorMessage: z.string().nullable(),
        workspaceId: z.coerce.string(),
      }),
      // REMINDER: cache the result for accessing the data for a check as it won't change
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcStatusWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_status_7d__v0",
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

  public get grpcMetricsByRegionDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_by_region_1d__v0",
      parameters: grpcMetricsByRegionParameters,
      data: grpcMetricsByRegionShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsByRegionWeekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_by_region_7d__v0",
      parameters: grpcMetricsByRegionParameters,
      data: grpcMetricsByRegionShape,
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get grpcMetricsByRegionBiweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__grpc_metrics_by_region_14d__v0",
      parameters: grpcMetricsByRegionParameters,
      data: grpcMetricsByRegionShape,
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

  public get dnsGlobalMetricsDaily() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_global_1d__v0",
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
        p50Dns: z.int().nullable().prefault(0),
        p50Ttfb: z.int().nullable().prefault(0),
        p50Transfer: z.int().nullable().prefault(0),
        p50Connect: z.int().nullable().prefault(0),
        p50Tls: z.int().nullable().prefault(0),
        p75Dns: z.int().nullable().prefault(0),
        p75Ttfb: z.int().nullable().prefault(0),
        p75Transfer: z.int().nullable().prefault(0),
        p75Connect: z.int().nullable().prefault(0),
        p75Tls: z.int().nullable().prefault(0),
        p90Dns: z.int().nullable().prefault(0),
        p90Ttfb: z.int().nullable().prefault(0),
        p90Transfer: z.int().nullable().prefault(0),
        p90Connect: z.int().nullable().prefault(0),
        p90Tls: z.int().nullable().prefault(0),
        p95Dns: z.int().nullable().prefault(0),
        p95Ttfb: z.int().nullable().prefault(0),
        p95Transfer: z.int().nullable().prefault(0),
        p95Connect: z.int().nullable().prefault(0),
        p95Tls: z.int().nullable().prefault(0),
        p99Dns: z.int().nullable().prefault(0),
        p99Ttfb: z.int().nullable().prefault(0),
        p99Transfer: z.int().nullable().prefault(0),
        p99Connect: z.int().nullable().prefault(0),
        p99Tls: z.int().nullable().prefault(0),
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
      data: z.object(dnsListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsListV2Biweekly() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_list_14d__v1",
      parameters: z.object({
        ...listV2WindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(dnsListRowShape),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get dnsListFacets() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_list_facets_14d__v0",
      parameters: z.object({
        ...facetWindowShape,
        ...responseLogFilterShape,
      }),
      data: z.object(facetRowShape),
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

  public get httpMetrics30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_30d__v1",
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

  public get httpMetrics90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_90d__v1",
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

  public get tcpMetrics30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_30d__v1",
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

  public get tcpMetrics90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_90d__v1",
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

  public get dnsMetrics30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_30d__v0",
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

  public get dnsMetrics90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_90d__v0",
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

  public get httpUptime90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_uptime_90d__v1",
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

  public get tcpUptime90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_uptime_90d__v1",
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

  public get dnsUptime90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_uptime_90d__v0",
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

  public get httpMetricsRegions30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_regions_30d__v0",
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

  public get httpMetricsRegions90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_regions_90d__v0",
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

  public get tcpMetricsByInterval30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_interval_30d__v0",
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

  public get tcpMetricsByInterval90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_by_interval_90d__v0",
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

  public get dnsMetricsRegions30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_regions_30d__v0",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().optional(),
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

  public get dnsMetricsRegions90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_regions_90d__v0",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().optional(),
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

  public get httpMetricsLatency30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_latency_30d__v1",
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

  public get httpMetricsLatency90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_metrics_latency_90d__v1",
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

  public get tcpMetricsLatency30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_latency_30d__v1",
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

  public get tcpMetricsLatency90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__tcp_metrics_latency_90d__v1",
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

  public get dnsMetricsLatency30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_latency_30d__v0",
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

  public get dnsMetricsLatency90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__dns_metrics_latency_90d__v0",
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

  public get httpTimingPhases30d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_timing_phases_30d__v1",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        p50Dns: z.int().nullable().prefault(0),
        p50Ttfb: z.int().nullable().prefault(0),
        p50Transfer: z.int().nullable().prefault(0),
        p50Connect: z.int().nullable().prefault(0),
        p50Tls: z.int().nullable().prefault(0),
        p75Dns: z.int().nullable().prefault(0),
        p75Ttfb: z.int().nullable().prefault(0),
        p75Transfer: z.int().nullable().prefault(0),
        p75Connect: z.int().nullable().prefault(0),
        p75Tls: z.int().nullable().prefault(0),
        p90Dns: z.int().nullable().prefault(0),
        p90Ttfb: z.int().nullable().prefault(0),
        p90Transfer: z.int().nullable().prefault(0),
        p90Connect: z.int().nullable().prefault(0),
        p90Tls: z.int().nullable().prefault(0),
        p95Dns: z.int().nullable().prefault(0),
        p95Ttfb: z.int().nullable().prefault(0),
        p95Transfer: z.int().nullable().prefault(0),
        p95Connect: z.int().nullable().prefault(0),
        p95Tls: z.int().nullable().prefault(0),
        p99Dns: z.int().nullable().prefault(0),
        p99Ttfb: z.int().nullable().prefault(0),
        p99Transfer: z.int().nullable().prefault(0),
        p99Connect: z.int().nullable().prefault(0),
        p99Tls: z.int().nullable().prefault(0),
      }),
    });
  }

  public get httpTimingPhases90d() {
    return this.tb.buildPipe({
      pipe: "endpoint__http_timing_phases_90d__v1",
      parameters: z.object({
        monitorId: z.string(),
        interval: z.int().optional(),
        regions: z.array(z.enum(monitorRegions).or(z.string())).optional(),
      }),
      data: z.object({
        timestamp: z.int(),
        p50Dns: z.int().nullable().prefault(0),
        p50Ttfb: z.int().nullable().prefault(0),
        p50Transfer: z.int().nullable().prefault(0),
        p50Connect: z.int().nullable().prefault(0),
        p50Tls: z.int().nullable().prefault(0),
        p75Dns: z.int().nullable().prefault(0),
        p75Ttfb: z.int().nullable().prefault(0),
        p75Transfer: z.int().nullable().prefault(0),
        p75Connect: z.int().nullable().prefault(0),
        p75Tls: z.int().nullable().prefault(0),
        p90Dns: z.int().nullable().prefault(0),
        p90Ttfb: z.int().nullable().prefault(0),
        p90Transfer: z.int().nullable().prefault(0),
        p90Connect: z.int().nullable().prefault(0),
        p90Tls: z.int().nullable().prefault(0),
        p95Dns: z.int().nullable().prefault(0),
        p95Ttfb: z.int().nullable().prefault(0),
        p95Transfer: z.int().nullable().prefault(0),
        p95Connect: z.int().nullable().prefault(0),
        p95Tls: z.int().nullable().prefault(0),
        p99Dns: z.int().nullable().prefault(0),
        p99Ttfb: z.int().nullable().prefault(0),
        p99Transfer: z.int().nullable().prefault(0),
        p99Connect: z.int().nullable().prefault(0),
        p99Tls: z.int().nullable().prefault(0),
      }),
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

  public get publishExternalStatus() {
    return this.tb.buildIngestEndpoint({
      datasource: "external_status__v1",
      event: z.object({
        id: z.string(),
        indicator: z.string(),
        status: z.string(),
        status_message: z.string(),
        fetched_at: z.int(),
        updated_at: z.int(),
        time_zone: z.string(),
      }),
    });
  }

  public get externalStatusLatest() {
    return this.tb.buildPipe({
      pipe: "endpoint__external_status_latest__v1",
      parameters: z.object({
        ids: z.array(z.string()).optional(),
      }),
      data: z.object({
        id: z.string(),
        indicator: z.string(),
        status: z.string(),
        status_message: z.string(),
        time_zone: z.string(),
        updated_at: z.int(),
        last_fetched_at: z.int(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get externalStatusHistory() {
    return this.tb.buildPipe({
      pipe: "endpoint__external_status_history__v0",
      parameters: z.object({
        ids: z.array(z.string()).min(1),
        days: z.int().min(1).max(90).optional(),
      }),
      data: z.object({
        ...externalStatusHistoryDailyShape,
        id: z.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get publishExternalStatusComponent() {
    return this.tb.buildIngestEndpoint({
      datasource: "external_status_component__v0",
      event: z.object({
        component_id: z.string(),
        external_service_id: z.int(),
        indicator: z.string(),
        status: z.string(),
        fetched_at: z.int(),
      }),
    });
  }

  public get externalStatusComponentHistory() {
    return this.tb.buildPipe({
      pipe: "endpoint__external_status_component_history__v0",
      parameters: z.object({
        component_ids: z.array(z.string()).min(1),
        days: z.int().min(1).max(90).optional(),
      }),
      data: z.object({
        ...externalStatusHistoryDailyShape,
        component_id: z.string(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }

  public get externalStatusComponentLatest() {
    return this.tb.buildPipe({
      pipe: "endpoint__external_status_component_latest__v0",
      parameters: z.object({
        component_ids: z.array(z.string()).min(1),
      }),
      data: z.object({
        component_id: z.string(),
        indicator: z.string(),
        status: z.string(),
        last_fetched_at: z.int(),
      }),
      opts: { next: { revalidate: REVALIDATE } },
    });
  }
}
