import { z } from "zod";

export const WebhookSchema = z.object({
  endpoint: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});


export const PayloadSchema = z.object({
  monitor: z.object({
    id: z.number(),
    name: z.string(),
    url: z.string(),
  }),
  cronTimestamp: z.number(),
  status:z.enum(["degraded", "error", "recovered"]),
  statusCode: z.number().optional(),
  latency: z.number().optional(),
  errorMessage: z.string().optional(),
});
