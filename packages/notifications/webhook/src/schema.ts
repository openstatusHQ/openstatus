import { z } from "zod";

export const WebhookSchema = z.object({
  webhook: z.object({
    endpoint: z.string().url(),
    headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  }),
});

export const PayloadSchema = z.object({
  monitor: z.object({
    id: z.number(),
    name: z.string(),
    url: z.string(),
  }),
  cronTimestamp: z.number(),
  status: z.enum(["degraded", "error", "recovered"]),
  statusCode: z.number().optional(),
  latency: z.number().optional(),
  errorMessage: z.string().optional(),
});
