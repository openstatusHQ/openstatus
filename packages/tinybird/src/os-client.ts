import { Tinybird } from "@chronark/zod-bird";
import { z } from "zod";

import { flyRegions } from "@openstatus/utils";

const MIN_CACHE = 30; // 30s
const DEFAULT_CACHE = 120; // 2min
const MAX_CACHE = 86400; // 1d

export const latencySchema = z.object({
  p50Latency: z.number().int().nullable(),
  p75Latency: z.number().int().nullable(),
  p90Latency: z.number().int().nullable(),
  p95Latency: z.number().int().nullable(),
  p99Latency: z.number().int().nullable(),
});

export const timingSchema = z.object({
  dnsStart: z.number(),
  dnsDone: z.number(),
  connectStart: z.number(),
  connectDone: z.number(),
  tlsHandshakeStart: z.number(),
  tlsHandshakeDone: z.number(),
  firstByteStart: z.number(),
  firstByteDone: z.number(),
  transferStart: z.number(),
  transferDone: z.number(),
});

export class OSTinybird {
  private tb: Tinybird;

  // FIXME: use Tinybird instead with super(args) maybe
  constructor(private args: { token: string; baseUrl?: string | undefined }) {
    this.tb = new Tinybird(args);
  }

  endpointChart(period: "1h" | "1d" | "3d" | "7d" | "14d") {
    const parameters = z.object({
      interval: z.number().int().optional(),
      monitorId: z.string(),
      url: z.string().optional(),
    });

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: `__ttl_${period}_chart_get__v0`,
          parameters,
          data: z
            .object({
              region: z.enum(flyRegions),
              timestamp: z.number().int(),
            })
            .merge(latencySchema),
          opts: {
            revalidate: DEFAULT_CACHE,
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointMetrics(period: "1h" | "1d" | "3d" | "7d" | "14d") {
    const parameters = z.object({
      monitorId: z.string(),
      url: z.string().optional(),
    });

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: `__ttl_${period}_metrics_get__v0`,
          parameters,
          data: z
            .object({
              region: z.enum(flyRegions).default("ams"), // FIXME: default
              count: z.number().default(0),
              ok: z.number().default(0),
              lastTimestamp: z.number().int().nullable(),
            })
            .merge(latencySchema),
          opts: {
            revalidate: DEFAULT_CACHE,
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointMetricsByRegion(period: "1h" | "1d" | "3d" | "7d" | "14d") {
    const parameters = z.object({
      monitorId: z.string(),
      url: z.string().optional(),
    });

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: `__ttl_${period}_metrics_get_by_region__v0`,
          parameters,
          data: z
            .object({
              region: z.enum(flyRegions),
              count: z.number().default(0),
              ok: z.number().default(0),
              lastTimestamp: z.number().int().optional(), // FIXME: optional
            })
            .merge(latencySchema),
          opts: {
            revalidate: DEFAULT_CACHE,
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointStatusPeriod(period: "7d" | "45d") {
    const parameters = z.object({
      monitorId: z.string(),
      url: z.string().optional(),
    });

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: `__ttl_${period}_count_get__v0`,
          parameters,
          data: z.object({
            day: z.string().transform((val) => {
              // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
              return new Date(`${val} GMT`).toISOString();
            }),
            count: z.number().default(0),
            ok: z.number().default(0),
          }),
          opts: {
            revalidate: DEFAULT_CACHE,
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  // TBH: not sure if we need more than 1d for that, better allow the user
  // to click on a specific region and time
  endpointList(period: "1h" | "1d") {
    const parameters = z.object({
      monitorId: z.string(),
      url: z.string().optional(),
    });

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: `__ttl_${period}_list_get__v0`,
          parameters,
          data: z.object({
            latency: z.number().int(), // in ms
            monitorId: z.string(),
            region: z.enum(flyRegions),
            statusCode: z.number().int().nullable().default(null),
            timestamp: z.number().int(),
            url: z.string().url(),
            workspaceId: z.string(),
            cronTimestamp: z.number().int().nullable().default(Date.now()),
          }),
          opts: {
            revalidate: DEFAULT_CACHE,
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
          pipe: `__ttl_1h_last_timestamp_${type}_get__v0`,
          parameters,
          data: z.object({ cronTimestamp: z.number().int() }),
          opts: {
            revalidate: MIN_CACHE,
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }

  endpointResponseDetails(period: "7d") {
    const parameters = z.object({
      monitorId: z.string().default("").optional(),
      url: z.string().url().optional(),
      region: z.enum(flyRegions).optional(),
      cronTimestamp: z.number().int().optional(),
    });

    return async (props: z.infer<typeof parameters>) => {
      try {
        const res = await this.tb.buildPipe({
          pipe: `__ttl_${period}_all_details_get__v0`, // TODO: make it also a bit dynamic to avoid query through too much data
          parameters,
          data: z.object({
            latency: z.number().int(), // in ms
            statusCode: z.number().int().nullable().default(null),
            monitorId: z.string().default(""),
            url: z.string().url().optional(),
            region: z.enum(flyRegions),
            cronTimestamp: z.number().int().optional(),
            message: z.string().nullable().optional(),
            headers: z
              .string()
              .nullable()
              .optional()
              .transform((val) => {
                if (!val) return null;
                const value = z
                  .record(z.string(), z.string())
                  .safeParse(JSON.parse(val));
                if (value.success) return value.data;
                return null;
              }),
            timing: z
              .string()
              .nullable()
              .optional()
              .transform((val) => {
                if (!val) return null;
                const value = timingSchema.safeParse(JSON.parse(val));
                if (value.success) return value.data;
                return null;
              }),
          }),
          opts: {
            revalidate: MAX_CACHE,
          },
        })(props);
        return res.data;
      } catch (e) {
        console.error(e);
      }
    };
  }
}

/**
 * TODO: if it would be possible to...
 */
