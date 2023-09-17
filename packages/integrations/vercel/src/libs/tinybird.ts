import { z } from "zod";

import { Tinybird } from "@openstatus/tinybird";

import { logDrainSchema } from "./schema";

const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY || "" }); // should we use t3-env?

export function publishVercelLogDrain() {
  return tb.buildIngestEndpoint({
    datasource: "vercel_log_drain__v0",
    event: logDrainSchema,
  });
}

export const getRequestByStatusCode = tb.buildPipe({
  pipe: "Vercel_request_by_projects",
  parameters: z.object({
    projectId: z.string(),
  }),
  data: z.object({
    statusCode: z.number(),
    count: z.number(),
  }),
});
