import { Tinybird } from "@chronark/zod-bird";
import { z } from "zod";

import { flyRegions } from "@openstatus/utils";

const DEFAULT_CACHE = 120; // 2min

export const latencySchema = z.object({
  p50Latency: z.number().int().nullable(),
  p75Latency: z.number().int().nullable(),
  p90Latency: z.number().int().nullable(),
  p95Latency: z.number().int().nullable(),
  p99Latency: z.number().int().nullable(),
});

/**
 * TODO: improve error handling and types
 * e.g. we shouldn't (await myFunction()).data - it should return the data directly
 * and handle the error in the function
 * see `endpointChart` for an example
 */

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
    return this.tb.buildPipe({
      pipe: `__ttl_${period}_metrics_get__v0`,
      parameters: z.object({
        monitorId: z.string(),
        url: z.string().optional(),
      }),
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
    });
  }

  endpointMetricsByRegion(period: "1h" | "1d" | "3d" | "7d" | "14d") {
    return this.tb.buildPipe({
      pipe: `__ttl_${period}_metrics_get_by_region__v0`,
      parameters: z.object({
        monitorId: z.string(),
        url: z.string().optional(),
      }),
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
    });
  }

  endpointStatusPeriod(period: "7d" | "45d") {
    return this.tb.buildPipe({
      pipe: `__ttl_${period}_count_get__v0`,
      parameters: z.object({
        monitorId: z.string(),
        // url: z.string().optional(), FIXME: in tb materialized view
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
        revalidate: DEFAULT_CACHE,
      },
    });
  }

  endpointList(period: "1h" | "1d") {
    return this.tb.buildPipe({
      pipe: `__ttl_${period}_list_get__v0`,
      parameters: z.object({
        monitorId: z.string(),
        url: z.string().optional(),
      }),
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
    });
  }
}
