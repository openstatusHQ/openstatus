import { z } from "zod";

// TODO: replace with correct schema
export const pingSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  statusCode: z.number(),
  latency: z.number(),
  url: z.string(),
});

export type Ping = z.infer<typeof pingSchema>;
