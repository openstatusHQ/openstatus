import { z } from "zod";
import { flyRegions } from "../../db/src/schema/constants";

// TODO: https://github.com/unkeyed/unkey/blob/main/apps/dashboard/lib/tinybird.ts#L523

export const jobTypes = ["http", "tcp", "imcp", "udp", "dns", "ssl"] as const;
export const jobTypeEnum = z.enum(jobTypes);
export type JobType = z.infer<typeof jobTypeEnum>;

export const periods = ["1h", "1d", "3d", "7d", "14d", "45d"] as const;
export const periodEnum = z.enum(periods);
export type Period = z.infer<typeof periodEnum>;

export const triggers = ["cron", "api"] as const;
export const triggerEnum = z.enum(triggers);
export type Trigger = z.infer<typeof triggerEnum>;

export const latencyPercenileSchema = z.object({
  p50Latency: z.number().int().nullable(),
  p75Latency: z.number().int().nullable(),
  p90Latency: z.number().int().nullable(),
  p95Latency: z.number().int().nullable(),
  p99Latency: z.number().int().nullable(),
});

export type LatencyPercentile = z.infer<typeof latencyPercenileSchema>;

export const httpTimingSchema = z.object({
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

export type HttpTiming = z.infer<typeof httpTimingSchema>;

export const tcpTimingSchema = z.object({
  tcpStart: z.number(),
  tcpDone: z.number(),
});

export type TcpTiming = z.infer<typeof tcpTimingSchema>;

/**
 * Based on period, most of the times, `endpointMetrics` will be in
 * pair to compare two periods.
 *
 * lastTimestamp is null on the second entry to mark the end (or in case of sorting)
 */
export const endpointMetricsSchema = z
  .object({
    region: z.enum(flyRegions),
    count: z.number().default(0),
    ok: z.number().default(0),
    lastTimestamp: z.number().int().nullable(),
  })
  .merge(latencyPercenileSchema);

export type EndpointMetrics = z.infer<typeof endpointMetricsSchema>;

export const endpointTrackerSchema = z.object({
  day: z.string().transform((val) => {
    // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
    return new Date(`${val} GMT`).toISOString();
  }),
  count: z.number().default(0),
  ok: z.number().default(0),
});

export type EndpointTracker = z.infer<typeof endpointTrackerSchema>;

export const endpointChartSchema = z
  .object({
    region: z.enum(flyRegions),
    timestamp: z.number().int(),
  })
  .merge(latencyPercenileSchema);

export const headersSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (!val) return null;
    const value = z.record(z.string(), z.string()).safeParse(JSON.parse(val));
    if (value.success) return value.data;
    return null;
  });

export const timingSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (!val) return null;
    const value = httpTimingSchema.safeParse(JSON.parse(val));
    if (value.success) return value.data;
    return null;
  });

export const httpCheckerSchema = z.object({
  type: z.literal("http").default("http"),
  latency: z.number().int(),
  statusCode: z.number().int().nullable(),
  monitorId: z.string(),
  url: z.string().url().optional(),
  error: z.coerce.boolean(),
  region: z.enum(flyRegions),
  cronTimestamp: z.number().int(),
  message: z.string().nullable(),
  headers: headersSchema,
  timing: timingSchema,
  // REMINDER: maybe include Assertions.serialize here
  assertions: z.string().nullable(),
  trigger: triggerEnum.nullable().default("cron"),
});

export type HttpChecker = z.infer<typeof httpCheckerSchema>;

export const tcpCheckerSchema = z.object({
  type: z.literal("tcp").default("tcp"),
  latency: z.number().int(),
  monitorId: z.coerce.number(),
  region: z.enum(flyRegions),
  uri: z.string(),
  error: z.coerce.boolean(),
  workspaceId: z.coerce.number(),
  cronTimestamp: z.number().int().nullable().default(Date.now()),
  trigger: triggerEnum.optional().nullable().default("cron"),
});

export type TcpChecker = z.infer<typeof tcpCheckerSchema>;
