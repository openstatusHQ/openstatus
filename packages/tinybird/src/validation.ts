import * as z from "zod";

export const vercelRegions = [
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "fra1",
  "gru1",
  "hkg1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
] as const;

export const flyRegions = ["ams", "iad", "hkg", "jnb", "syd", "gru"] as const;

export const availableRegions = [...vercelRegions, ...flyRegions] as const;

/**
 * Values for the datasource ping_response__v4
 */
export const tbIngestPingResponse = z.object({
  id: z.string(),
  workspaceId: z.string(),
  monitorId: z.string(),
  timestamp: z.number().int(),
  statusCode: z.number().int(),
  latency: z.number(), // in ms
  cronTimestamp: z.number().int().optional().nullable().default(Date.now()),
  url: z.string().url(),
  region: z.string().min(3).max(4), // REMINDER: won't work on fy
});

/**
 * Values from the pipe response_list__v1
 */
export const tbBuildResponseList = z.object({
  id: z.string(),
  workspaceId: z.string(),
  monitorId: z.string(),
  timestamp: z.number().int(),
  statusCode: z.number().int(),
  latency: z.number().int(), // in ms
  cronTimestamp: z.number().int().nullable().default(Date.now()),
  url: z.string().url(),
  region: z.enum(availableRegions),
});

/**
 * Params for pipe response_list__v1
 */
export const tbParameterResponseList = z.object({
  monitorId: z.string().default(""), // REMINDER: remove default once alpha
  fromDate: z.number().int().default(0), // always start from a date
  toDate: z.number().int().optional(),
  limit: z.number().int().optional().default(7500), // one day has 2448 pings (17 (regions) * 6 (per hour) * 24) * 3 days for historical data
  region: z.enum(availableRegions).optional(),
  cronTimestamp: z.number().int().optional(),
});

/**
 * Params for pipe status_timezone__v0
 */
export const tbParameterMonitorList = z.object({
  monitorId: z.string(),
  timezone: z.string().optional(),
  limit: z.number().int().default(46).optional(), // 46 days
});

/**
 * Values from the pipe status_timezone__v0
 */
export const tbBuildMonitorList = z.object({
  count: z.number().int(),
  ok: z.number().int(),
  avgLatency: z.number().int(),
  day: z.coerce.date(),
});

/**
 * Params for pipe home_stats__v0
 */
export const tbParameterHomeStats = z.object({
  cronTimestamp: z.number().int().optional(),
  period: z.enum(["total", "1h", "10m"]).optional(),
});

/**
 * Values from the pipe home_stats__v0
 */
export const tbBuildHomeStats = z.object({
  count: z.number().int(),
});

export type Ping = z.infer<typeof tbBuildResponseList>;
export type Region = (typeof availableRegions)[number]; // TODO: rename type AvailabeRegion
export type Monitor = z.infer<typeof tbBuildMonitorList>;
export type HomeStats = z.infer<typeof tbBuildHomeStats>;
export type ResponseListParams = z.infer<typeof tbParameterResponseList>;
export type MonitorListParams = z.infer<typeof tbParameterMonitorList>;
export type HomeStatsParams = z.infer<typeof tbParameterHomeStats>;
