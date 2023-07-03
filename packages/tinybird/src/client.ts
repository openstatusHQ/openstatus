import type { Tinybird } from "@chronark/zod-bird";
import * as z from "zod";

// is it the correct place?
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

export const availableRegionsEnum = z.enum(availableRegions);

export type Region = (typeof availableRegions)[number];

// REMINDER:
// const tb = new Tinybird({ token: process.env.TINYBIRD_TOKEN! });

export const tinyBirdEventType = z.object({
  id: z.string(),
  workspaceId: z.string(),
  pageId: z.string(),
  monitorId: z.string(),
  timestamp: z.number().int(),
  statusCode: z.number().int(),
  latency: z.number().int(), // in ms
  url: z.string(),
  metadata: z.string().optional().default(""), // TODO: transform on pipe
  region: z.string().min(4).max(4), // TODO: object + stringify json
});

export type Ping = z.infer<typeof tinyBirdEventType>;

export function publishPingResponse(tb: Tinybird) {
  return tb.buildIngestEndpoint({
    datasource: "ping_response__v2",
    event: tinyBirdEventType,
  });
}

export function getResponseList(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "response_list__v1",
    parameters: z.object({
      siteId: z.string().default("openstatus"), // REMINDER: remove default once alpha
      monitorId: z.string().default("openstatus"), // REMINDER: remove default once alpha
      start: z.number().int().default(0), // always start from a date
      end: z.number().int().optional(),
      limit: z.number().int().optional().default(100), // used for pagination
      region: z.enum(availableRegions).optional(),
    }),
    data: tinyBirdEventType,
    opts: {
      revalidate: 5 * 60, // 5 minutes cache validation
    },
  });
}
