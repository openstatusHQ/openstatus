import * as z from "zod";
import type { Tinybird } from "@chronark/zod-bird";

// REMINDER:
// const tb = new Tinybird({ token: process.env.TINYBIRD_TOKEN! });

// An alternative to
const VERION = "v0";
const DATASOURCE = {};

// TODO: think of a better name `publishHttpResponse`
export function publishPingResponse(tb: Tinybird) {
  return tb.buildIngestEndpoint({
    datasource: "ping_response__v0",
    event: z.object({
      id: z.string(),
      timestamp: z.number().int(),
      statusCode: z.number().int(),
      metadata: z.string().optional().default(""),
    }),
  });
}

export function getResponseList(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "response_list__v0",
    parameters: z.object({
      start: z.number().int(), // always start from a date
      end: z.number().int().optional(),
    }),
    data: z.object({
      id: z.string(),
      timestamp: z.number().int(),
      statusCode: z.number().int(),
    }),
  });
}
