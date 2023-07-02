import type { Tinybird } from "@chronark/zod-bird";
import * as z from "zod";

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
  metadata: z.string().optional().default(""),
  region: z.string().min(4).max(4), // TODO: object + stringify json
});

// TODO: think of a better name `publishHttpResponse`
export function publishPingResponse(tb: Tinybird) {
  return tb.buildIngestEndpoint({
    datasource: "ping_response__v0",
    event: tinyBirdEventType.omit({ id: true }),
  });
}

export function getResponseList(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "response_list__v0",
    parameters: z.object({
      siteId: z.string().default("openstatus"), // REMINDER: remove default once alpha
      monitorId: z.string().default("openstatus"), // REMINDER: remove default once alpha
      start: z.number().int().default(0), // always start from a date
      end: z.number().int().optional(),
      limit: z.number().int().optional().default(100), // used for pagination
    }),
    data: tinyBirdEventType.omit({
      workspaceId: true,
      pageId: true,
      monitorId: true,
      region: true,
    }),
    opts: {
      revalidate: 5 * 60, // 5 minutes cache validation
    },
  });
}
