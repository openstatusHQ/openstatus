import { NoopTinybird, Tinybird } from "@chronark/zod-bird";
import { z } from "zod";

import { flyRegions } from "../../db/src/schema/constants";
import {
  endpointMetricsSchema,
  endpointTrackerSchema,
  httpCheckerSchema,
  httpTimingSchema,
  latencyPercenileSchema,
  tcpCheckerSchema,
} from "./schema";

const isProd = process.env.NODE_ENV === "production";

const DEV_CACHE = 3_600; // 1h

const MIN_CACHE = isProd ? 60 : DEV_CACHE; // 60s
const DEFAULT_CACHE = isProd ? 120 : DEV_CACHE; // 2min
const _MAX_CACHE = 86_400; // 1d

const VERSION = "v1";

// TODO: check if we can use the jobType from the schema
const jobType = z.enum(["http", "tcp", "imcp", "udp", "dns", "ssl"]);
const period = z.enum(["1h", "1d", "3d", "7d", "14d", "45d"]); // REMINDER: "45d" is not used within dashboard
type JobType = z.infer<typeof jobType>;
type Period = z.infer<typeof period>;
type LongPeriod = Extract<Period, "7d" | "14d">;
type TimeZone = "UTC"; // "EST" | "PST" | "CET"

export class OSTinybird {
  private tb: Tinybird;
  // private: http: HttpJobType;

  // FIXME: use Tinybird instead with super(args) maybe
  // how about passing here the `opts: {revalidate}` to access it within the functions?
  constructor(private args: { token: string; baseUrl?: string | undefined }) {
    // if (process.env.NODE_ENV === "development") {
    //   this.tb = new NoopTinybird();
    // } else {
    this.tb = new Tinybird(args);
    // }
  }

  endpointChart({ period, type }: { period: Period; type: JobType }) {
    const parameters = z.object({
      interval: z.number().int().optional(),
      monitorId: z.string(),
    });

    function getPipeName() {
      switch (type) {
        case "http":
          return `__ttl_${period}_chart_get__${VERSION}`;
        case "tcp":
          return `__ttl_chart_tcp_get__${VERSION}`;
        default:
          return "";
      }
    }

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: getPipeName(),
          parameters,
          data: z
            .object({
              region: z.enum(flyRegions),
              timestamp: z.number().int(),
            })
            .merge(latencyPercenileSchema),
          opts: {
            cache: "no-store",
            // next: {
            //   revalidate: DEFAULT_CACHE,
            // },
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointChartAllRegions({
    period,
    type,
  }: {
    period: Extract<Period, "7d" | "14d">;
    type: JobType;
  }) {
    const parameters = z.object({ monitorId: z.string() });

    function getPipeName() {
      switch (type) {
        case "http":
          return `__ttl_${period}_chart_all_regions_get__${VERSION}`;
        case "tcp":
          return `__ttl_chart_all_regions_tcp_get__${VERSION}`;
        default:
          return "";
      }
    }

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: getPipeName(),
          parameters,
          data: z
            .object({ timestamp: z.number().int() })
            .merge(latencyPercenileSchema),
          opts: {
            cache: "no-store",
            // next: {
            //   revalidate: DEFAULT_CACHE,
            // },
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointMetrics({ period, type }: { period: Period; type: JobType }) {
    const parameters = z.object({ monitorId: z.string() });

    function getPipeName() {
      switch (type) {
        case "http":
          return `__ttl_${period}_metrics_get__${VERSION}`;
        case "tcp":
          // REMINDER: create materialized views for tcp
          return `tcp__ttl_14d_metrics_get__${VERSION}`;
        default:
          return "";
      }
    }

    return async (
      props: z.infer<typeof parameters>,
      opts?: {
        cache?: RequestCache | undefined;
        revalidate: number | undefined;
      } // RETHINK: not the best way to handle it
    ) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: getPipeName(),
          parameters,
          data: endpointMetricsSchema,
          opts: {
            cache: opts?.cache,
            next: {
              revalidate: opts?.revalidate || DEFAULT_CACHE,
            },
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointMetricsByRegion({ period, type }: { period: Period; type: JobType }) {
    const parameters = z.object({ monitorId: z.string() });

    function getPipeName() {
      switch (type) {
        case "http":
          return `__ttl_${period}_metrics_by_region_get__${VERSION}`;
        case "tcp":
          // REMIMDER: create materialized views for tcp
          return `tcp__ttl_14d_metrics_by_region_tcp_get__${VERSION}`;
        default:
          return "";
      }
    }

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: getPipeName(),
          parameters,
          data: endpointMetricsSchema,
          opts: {
            cache: "no-store",
            // next: {
            //   revalidate: DEFAULT_CACHE,
            // },
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointStatusPeriod({
    timezone = "UTC",
    period,
    type,
  }: {
    period: Period;
    timezone?: TimeZone;
    type: JobType;
  }) {
    const parameters = z.object({ monitorId: z.string() });

    function getPipeName() {
      switch (type) {
        case "http":
          return `__ttl_${period}_count_${timezone.toLowerCase()}_get__${VERSION}`;
        case "tcp":
          // REMINDER: create materialized views for tcp
          return `tcp__ttl_45d_count_${timezone.toLowerCase()}_get__${VERSION}`;
        default:
          return "";
      }
    }

    return async (
      props: z.infer<typeof parameters>,
      opts?: {
        cache?: RequestCache | undefined;
        revalidate: number | undefined;
      } // RETHINK: not the best way to handle it
    ) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: getPipeName(),
          parameters,
          data: endpointTrackerSchema,
          opts: {
            cache: opts?.cache,
            next: {
              revalidate: opts?.revalidate || DEFAULT_CACHE,
            },
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointList({ period, type }: { period: Period; type: JobType }) {
    const parameters = z.object({ monitorId: z.string() });

    function getPipeName() {
      switch (type) {
        case "http":
          return `__ttl_${period}_list_get__${VERSION}`;
        case "tcp":
          return `tcp__ttl_14d_list_get__${VERSION}`;
        default:
          return "";
      }
    }

    return async (props: z.infer<typeof parameters>) => {
      try {
        // FIXME: consider using
        const res = await this.tb.buildPipe({
          pipe: getPipeName(),
          parameters,
          data: type === "http" ? httpCheckerSchema : tcpCheckerSchema,
          opts: {
            cache: "no-store",
            // next: {
            //   revalidate: DEFAULT_CACHE,
            // },
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  // FEATURE: include a simple Widget for the user to refresh the page or display on the top of the page
  // type: "workspace" | "monitor"
  endpointLastCronTimestamp(type: "workspace") {
    const parameters = z.object({ workspaceId: z.string() });

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: `__ttl_1h_last_timestamp_${type}_get__${VERSION}`,
          parameters,
          data: z.object({ cronTimestamp: z.number().int() }),
          opts: {
            next: {
              revalidate: MIN_CACHE,
            },
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointResponseDetails({ period, type }: { period: Period; type: JobType }) {
    const parameters = z.object({
      monitorId: z.string().default("").optional(),
      region: z.enum(flyRegions).optional(),
      cronTimestamp: z.number().int().optional(),
    });

    function getPipeName() {
      switch (type) {
        case "http":
          return `__ttl_${period}_all_details_get__${VERSION}`;
        case "tcp":
          return `__ttl_all_details_tcp_get__${VERSION}`;
        default:
          return "";
      }
    }

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: getPipeName(),
          parameters,
          data: httpCheckerSchema,
          opts: {
            cache: "no-store",
            // next: {
            //   revalidate: MAX_CACHE,
            // },
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  getResultForOnDemandCheckHttp() {
    const parameters = z.object({
      monitorId: z.number().int(),
      timestamp: z.number(),
      url: z.string(),
    });
    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: "get_result_for_on_demand_check_http",
          parameters,
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
          opts: {
            next: {
              revalidate: MIN_CACHE,
            },
          },
        })(props);
        return res.data[0];
      } catch (e) {
        console.error(e);
      }
    };
  }
}

/**
 * TODO: if it would be possible to...
 */
