import * as z from "zod";
import type { Tinybird } from "@chronark/zod-bird";

// REMINDER:
// const tb = new Tinybird({ token: process.env.TINYBIRD_TOKEN! });

// TODO: think of a better name `publishHttpResponse`
export function publishPingResponse(tb: Tinybird) {
  return tb.buildIngestEndpoint({
    datasource: "ping_response__v0",
    event: z.object({
      id: z.string(),
      timestamp: z.number().int(),
      statusCode: z.number().int(),
      latency: z.number().int(), // in ms
      url: z.string(),
      metadata: z.string().optional().default(""), // TODO: object + stringify json
    }),
  });
}

export function getResponseList(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "response_list__v0",
    parameters: z.object({
      siteId: z.string().default("openstatus"), // REMINDER: remove default once alpha
      start: z.number().int().default(0), // always start from a date
      end: z.number().int().optional(),
      limit: z.number().int().optional().default(50), // used for pagination
    }),
    data: z.object({
      id: z.string(),
      timestamp: z.number().int(), // .transform(t => new Date(t))
      statusCode: z.number().int(),
      latency: z.number().int(),
      url: z.string(),
      // metadata: z.string().transform((m) => JSON.parse(m))
    }),
    opts: {
      revalidate: 0, // 5 * 60, // 5 minutes cache validation
    },
  });
}
