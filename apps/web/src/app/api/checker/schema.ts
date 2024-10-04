import { z } from "zod";

import { base } from "@openstatus/assertions";
import { monitorMethods, monitorStatus } from "@openstatus/db/src/schema";

export const httpPayloadSchema = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  method: z.enum(monitorMethods),
  body: z.string().optional(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  url: z.string(),
  cronTimestamp: z.number(),
  status: z.enum(monitorStatus),
  assertions: z.array(base).nullable(),
  timeout: z.number().default(45000),
  degradedAfter: z.number().nullable(),
});

export type HttpPayload = z.infer<typeof httpPayloadSchema>;

export const tpcPayloadSchema = z.object({
  status: z.enum(monitorStatus),
  workspaceId: z.string(),
  url: z.string(),
  monitorId: z.string(),
  assertions: z.array(base).nullable(),
  cronTimestamp: z.number(),
  timeout: z.number().default(45000),
  degradedAfter: z.number().nullable(),
});
