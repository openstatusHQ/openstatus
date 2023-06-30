import { z } from "zod";

// We're keeping a simple non-relational schema here.
// IRL, you will have a schema for your data models.
export const pingSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  statusCode: z.number(),
  latency: z.number(),
  url: z.string(),
});

export type Ping = z.infer<typeof pingSchema>;
