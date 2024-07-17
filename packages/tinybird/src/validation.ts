import * as z from "zod";
import { monitorFlyRegionSchema } from "../../db/src/schema/shared";
import type { flyRegions } from "../../db/src/schema/shared";

export const tbIngestWebVitals = z.object({
  dsn: z.string(),
  href: z.string(),
  speed: z.string(),
  path: z.string(),
  screen: z.string(),
  name: z.string(),
  rating: z.string().optional(),
  value: z.number(),
  id: z.string(),
  session_id: z.string(),
  browser: z.string().default(""),
  city: z.string().default(""),
  country: z.string().default(""),
  continent: z.string().default(""),
  device: z.string().default(""),
  region_code: z.string().default(""),
  timezone: z.string().default(""),
  os: z.string(),
  timestamp: z.number().int(),
});

export const responseRumPageQuery = z.object({
  path: z.string(),
  totalSession: z.number(),
  cls: z.number(),
  fcp: z.number(),
  // fid: z.number(),
  inp: z.number(),
  lcp: z.number(),
  ttfb: z.number(),
});

export const sessionRumPageQuery = z.object({
  session_id: z.string(),
  cls: z.number(),
  fcp: z.number(),
  // fid: z.number(),
  inp: z.number(),
  lcp: z.number(),
  ttfb: z.number(),
});

export const tbIngestWebVitalsArray = z.array(tbIngestWebVitals);
/**
 * Values for the datasource ping_response
 */
export const tbIngestPingResponse = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  timestamp: z.number().int(),
  statusCode: z.number().int().nullable().optional(),
  latency: z.number(), // in ms
  cronTimestamp: z.number().int().optional().nullable().default(Date.now()),
  url: z.string().url(),
  region: z.string().min(3).max(4), // REMINDER: won't work on fy
  message: z.string().nullable().optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
  timing: z
    .object({
      dnsStart: z.number().int(),
      dnsDone: z.number().int(),
      connectStart: z.number().int(),
      connectDone: z.number().int(),
      tlsHandshakeStart: z.number().int(),
      tlsHandshakeDone: z.number().int(),
      firstByteStart: z.number().int(),
      firstByteDone: z.number().int(),
      transferStart: z.number().int(),
      transferDone: z.number().int(),
    })
    .nullable()
    .optional(),
});

/**
 * Values from the pipe response_list
 */
export const tbBuildResponseList = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  timestamp: z.number().int(),
  error: z
    .number()
    .default(0)
    .transform((val) => val !== 0),
  statusCode: z.number().int().nullable().default(null),
  latency: z.number().int(), // in ms
  cronTimestamp: z.number().int().nullable().default(Date.now()),
  url: z.string().url(),
  region: monitorFlyRegionSchema,
  message: z.string().nullable().optional(),
  assertions: z.string().nullable().optional(),
});

/**
 * Params for pipe response_list
 */
export const tbParameterResponseList = z.object({
  monitorId: z.string().default(""), // REMINDER: remove default once alpha
  url: z.string().url().optional(),
  fromDate: z.number().int().default(0), // always start from a date
  toDate: z.number().int().optional(),
  limit: z.number().int().optional().default(7500), // one day has 2448 pings (17 (regions) * 6 (per hour) * 24) * 3 days for historical data
  region: monitorFlyRegionSchema.optional(),
  cronTimestamp: z.number().int().optional(),
});

/**
 * Params for pipe response_details
 */
export const tbParameterResponseDetails = tbParameterResponseList.pick({
  monitorId: true,
  url: true,
  cronTimestamp: true,
  region: true,
});

export const responseHeadersSchema = z.record(z.string(), z.string());
export const responseTimingSchema = z.object({
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

/**
 * Values from the pipe response_details
 */
export const tbBuildResponseDetails = tbBuildResponseList.extend({
  message: z.string().nullable().optional(),
  headers: z
    .string()
    .nullable()
    .optional()
    .transform((val) => {
      if (!val) return null;
      const value = responseHeadersSchema.safeParse(JSON.parse(val));
      if (value.success) return value.data;
      return null;
    }),
  timing: z
    .string()
    .nullable()
    .optional()
    .transform((val) => {
      if (!val) return null;
      const value = responseTimingSchema.safeParse(JSON.parse(val));
      if (value.success) return value.data;
      return null;
    }),
});

export const latencyMetrics = z.object({
  p50Latency: z.number().int().nullable(),
  p75Latency: z.number().int().nullable(),
  p90Latency: z.number().int().nullable(),
  p95Latency: z.number().int().nullable(),
  p99Latency: z.number().int().nullable(),
});

/**
 * Values from pipe response_graph
 */
export const tbBuildResponseGraph = z
  .object({
    region: monitorFlyRegionSchema,
    timestamp: z.number().int(),
  })
  .merge(latencyMetrics);

/**
 * Params for pipe response_graph
 */
export const tbParameterResponseGraph = z.object({
  monitorId: z.string().default(""),
  url: z.string().url().optional(),
  interval: z.number().int().default(10),
  fromDate: z.number().int().default(0),
  toDate: z.number().int().optional(),
});

/**
 * Params for pipe status_timezone
 */
export const tbParameterMonitorList = z.object({
  monitorId: z.string(),
  url: z.string().url().optional(),
  timezone: z.string().optional(),
  limit: z.number().int().default(46).optional(), // 46 days
});

/**
 * Values from the pipe status_timezone
 */
export const tbBuildMonitorList = z.object({
  count: z.number().int(),
  ok: z.number().int(),
  day: z.string().transform((val) => {
    // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
    return new Date(`${val} GMT`).toISOString();
  }),
});

/**
 * Params for pipe home_stats
 */
export const tbParameterHomeStats = z.object({
  cronTimestamp: z.number().int().optional(),
  period: z.enum(["total", "1h", "10m"]).optional(),
});

/**
 * Values from the pipe home_stats
 */
export const tbBuildHomeStats = z.object({
  count: z.number().int(),
});

/**
 * Params for pipe public_status (used for our API /public/status/[slug])
 */
export const tbParameterPublicStatus = z.object({
  monitorId: z.string(),
  url: z.string().url().optional(),
  limit: z.number().int().default(5).optional(), // 5 last cronTimestamps
});

/**
 * Values from the pipe public_status (used for our API /public/status/[slug])
 */
export const tbBuildPublicStatus = z.object({
  ok: z.number().int(),
  count: z.number().int(),
  cronTimestamp: z.number().int(),
});

/**
 * Params for pipe response_time_metrics
 */
export const tbParameterResponseTimeMetrics = z.object({
  monitorId: z.string(),
  url: z.string().url().optional(),
  interval: z.number().int().default(24), // 24 hours
});

/**
 * Values from the pipe response_time_metrics
 */
export const tbBuildResponseTimeMetrics = z
  .object({
    count: z.number().int(),
    ok: z.number().int(),
    lastTimestamp: z.number().int().nullable().optional(),
  })
  .merge(latencyMetrics);

/**
 * Params for pipe response_time_metrics_by_region
 */
export const tbParameterResponseTimeMetricsByRegion = z.object({
  monitorId: z.string(),
  url: z.string().url().optional(),
  interval: z.number().int().default(24), // 24 hours
});

/**
 * Values from the pipe response_time_metrics_by_region
 */
export const tbBuildResponseTimeMetricsByRegion = z
  .object({
    region: monitorFlyRegionSchema,
  })
  .merge(latencyMetrics);

export type Ping = z.infer<typeof tbBuildResponseList>;
export type Region = (typeof flyRegions)[number]; // TODO: rename type AvailabeRegion
export type Monitor = z.infer<typeof tbBuildMonitorList>;
export type HomeStats = z.infer<typeof tbBuildHomeStats>;
export type ResponseGraph = z.infer<typeof tbBuildResponseGraph>; // TODO: rename to ResponseQuantileChart
export type ResponseListParams = z.infer<typeof tbParameterResponseList>;
export type ResponseGraphParams = z.infer<typeof tbParameterResponseGraph>;
export type MonitorListParams = z.infer<typeof tbParameterMonitorList>;
export type HomeStatsParams = z.infer<typeof tbParameterHomeStats>;
export type ResponseDetails = z.infer<typeof tbBuildResponseDetails>;
export type ResponseDetailsParams = z.infer<typeof tbParameterResponseDetails>;
export type LatencyMetric = keyof z.infer<typeof latencyMetrics>;
export type ResponseTimeMetrics = z.infer<typeof tbBuildResponseTimeMetrics>;
export type ResponseTimeMetricsParams = z.infer<
  typeof tbParameterResponseTimeMetrics
>;
export type ResponseTimeMetricsByRegion = z.infer<
  typeof tbBuildResponseTimeMetricsByRegion
>;
export type ResponseTimeMetricsByRegionParams = z.infer<
  typeof tbParameterResponseTimeMetricsByRegion
>;
