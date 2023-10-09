import * as z from "zod";

// Frankfurt, Germany
// Ashburn, Virginia, USA
// Mumbai, India
// Johannesburg, South Africa
// Sydney, Australia
// São Paulo, Brazil
export const FlyRegion = ["fra", "iad", "bom", "jnb", "syd", "gru"] as const;
/**
 * Values for the datasource ping_response__v3
 */
export const tbIngestPingResponse = z.object({
  id: z.string(),
  workspaceId: z.string(),
  pageId: z.string(),
  monitorId: z.string(),
  timestamp: z.number().int(),
  statusCode: z.number().int(),
  latency: z.number().int(), // in ms
  cronTimestamp: z.number().int().optional().nullable().default(Date.now()),
  url: z.string().url(),
  metadata: z.string().optional().default("{}").nullable(),
  region: z.string().min(4).max(4),
});

/**
 * Values from the pip response_list__v0
 */
export const tbBuildResponseList = z.object({
  id: z.string(),
  workspaceId: z.string(),
  pageId: z.string(),
  monitorId: z.string(),
  timestamp: z.number().int(),
  statusCode: z.number().int(),
  latency: z.number().int(), // in ms
  cronTimestamp: z.number().int().nullable().default(Date.now()),
  url: z.string().url(),
  metadata: z
    .string()
    .default("{}")
    .transform((t) => JSON.parse(t))
    .nullable(),
  region: z.enum(FlyRegion),
});

/**
 * Params for pipe response_list__v0
 */
export const tbParameterResponseList = z.object({
  monitorId: z.string().default(""), // REMINDER: remove default once alpha
  fromDate: z.number().int().default(0), // always start from a date
  toDate: z.number().int().optional(),
  limit: z.number().int().optional().default(7500), // one day has 2448 pings (17 (regions) * 6 (per hour) * 24) * 3 days for historical data
  region: z.enum(FlyRegion).optional(),
  cronTimestamp: z.number().int().optional(),
});

/**
 * All `groupBy` options for the monitoring list
 * - "day" will aggregate data within the same day
 * - "cron" will get data from single cron job
 */
export const groupByRange = ["day", "cron"] as const;

/**
 * Params for pipe monitor_list__v0
 */
export const tbParameterMonitorList = z.object({
  monitorId: z.string().optional().default(""), // REMINDER: remove default once alpha
  limit: z.number().int().optional().default(2500), // one day has 2448 pings (17 (regions) * 6 (per hour) * 24)
  cronTimestamp: z.number().int().optional(),
  groupBy: z.enum(groupByRange).optional(), // TODO: rename to frequency: z.enum(["1d", "auto"]) - where "auto" the default periodicity setup
});

/**
 * Values from the pipe monitor_list__v0
 */
export const tbBuildMonitorList = z.object({
  count: z.number().int(),
  ok: z.number().int(),
  avgLatency: z.number().int(), // in ms
  cronTimestamp: z.number().int(),
});

/**
 * Params for pipe home_stats__v0
 */
export const tbParameterHomeStats = z.object({
  cronTimestamp: z.number().int().optional(),
});

/**
 * Values from the pipe home_stats__v0
 */
export const tbBuildHomeStats = z.object({
  count: z.number().int(),
});

export type Ping = z.infer<typeof tbBuildResponseList>;
export type Region = (typeof FlyRegion)[number]; // TODO: rename type AvailabeRegion
export type Monitor = z.infer<typeof tbBuildMonitorList>;
export type HomeStats = z.infer<typeof tbBuildHomeStats>;
export type ResponseListParams = z.infer<typeof tbParameterResponseList>;
export type MonitorListParams = z.infer<typeof tbParameterMonitorList>;
export type HomeStatsParams = z.infer<typeof tbParameterHomeStats>;
export type GroupByRange = (typeof groupByRange)[number];
