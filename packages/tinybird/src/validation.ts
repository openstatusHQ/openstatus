import * as z from "zod";

import { flyRegions } from "@openstatus/utils";

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
  statusCode: z.number().int().nullable().default(null),
  latency: z.number().int(), // in ms
  cronTimestamp: z.number().int().nullable().default(Date.now()),
  url: z.string().url(),
  region: z.enum(flyRegions),
  message: z.string().nullable().optional(),
});

/**
 * Params for pipe response_list
 */
export const tbParameterResponseList = z.object({
  monitorId: z.string().default(""), // REMINDER: remove default once alpha
  fromDate: z.number().int().default(0), // always start from a date
  toDate: z.number().int().optional(),
  limit: z.number().int().optional().default(7500), // one day has 2448 pings (17 (regions) * 6 (per hour) * 24) * 3 days for historical data
  region: z.enum(flyRegions).optional(),
  cronTimestamp: z.number().int().optional(),
});

/**
 * Params for pipe response_details
 */
export const tbParameterResponseDetails = tbParameterResponseList.pick({
  monitorId: true,
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
  avgLatency: z.number().int().nullable(),
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
    region: z.enum(flyRegions),
    timestamp: z.number().int(),
  })
  .merge(latencyMetrics);

/**
 * Params for pipe response_graph
 */
export const tbParameterResponseGraph = z.object({
  monitorId: z.string().default(""),
  interval: z.number().int().default(10),
  fromDate: z.number().int().default(0),
  toDate: z.number().int().optional(),
});

/**
 * Params for pipe status_timezone
 */
export const tbParameterMonitorList = z.object({
  monitorId: z.string(),
  timezone: z.string().optional(),
  limit: z.number().int().default(46).optional(), // 46 days
});

/**
 * Values from the pipe status_timezone
 */
export const tbBuildMonitorList = z
  .object({
    count: z.number().int(),
    ok: z.number().int(),
    day: z.string().transform((val) => {
      // That's a hack because clickhouse return the date in UTC but in shitty format (2021-09-01 00:00:00)
      return new Date(`${val} GMT`).toISOString();
    }),
  })
  .merge(latencyMetrics);

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
    time: z.number().int(), // only to sort the data - cannot be done on server because of UNION ALL
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
