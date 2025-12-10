import { webhookDataSchema } from "@openstatus/db/src/schema";
import { z } from "zod";

export const WebhookSchema = webhookDataSchema;

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
