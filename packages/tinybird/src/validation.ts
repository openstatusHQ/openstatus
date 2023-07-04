import * as z from "zod";

/**
 * All available Vercel (AWS) regions
 */
export const availableRegions = [
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "ewr1",
  "fra1",
  "gru1",
  "hkg1",
  "hnd1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
] as const;

/**
 * Values for the datasource ping_response_v2
 */
export const tbIngestPingResponse = z.object({
  id: z.string(),
  workspaceId: z.string(),
  pageId: z.string(),
  monitorId: z.string(),
  timestamp: z.number().int(),
  statusCode: z.number().int(),
  latency: z.number().int(), // in ms
  cronTimestamp: z.number().int().optional().default(Date.now()),
  url: z.string().url(),
  metadata: z
    .record(z.string(), z.unknown())
    .default({})
    .transform((t) => JSON.stringify(t))
    .optional(),
  region: z.string().min(4).max(4),
});

/**
 * Values from the pip response_list_v1
 */
export const tbBuildResponseList = z.object({
  id: z.string(),
  workspaceId: z.string(),
  pageId: z.string(),
  monitorId: z.string(),
  timestamp: z.number().int(),
  statusCode: z.number().int(),
  latency: z.number().int(), // in ms
  cronTimestamp: z.number().int().default(Date.now()),
  url: z.string().url(),
  metadata: z
    .string()
    .default("{}")
    .transform((t) => JSON.parse(t)),
  region: z.string().min(4).max(4),
});

/**
 * Params for pipe response_list_v1
 */
export const tbParameterResponseList = z.object({
  siteId: z.string().optional().default("openstatus"), // REMINDER: remove default once alpha
  monitorId: z.string().optional().default("openstatus"), // REMINDER: remove default once alpha
  start: z.number().int().default(0), // always start from a date
  end: z.number().int().optional(),
  limit: z.number().int().optional().default(100), // used for pagination
  region: z.enum(availableRegions).optional(),
});

export type Ping = z.infer<typeof tbIngestPingResponse>;
export type Region = (typeof availableRegions)[number];
export type ResponseListParams = z.infer<typeof tbParameterResponseList>;
