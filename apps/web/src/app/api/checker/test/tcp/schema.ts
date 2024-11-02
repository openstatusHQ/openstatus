import { z } from "zod";

import { monitorFlyRegionSchema } from "@openstatus/db/src/schema/constants";

export const tcpPayload = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  url: z.string(),
  cronTimestamp: z.number(),
  timeout: z.number().default(45000),
  degradedAfter: z.number().nullable(),
});

export const TCPResponse = z.object({
  type: z.literal("tcp").default("tcp"),
  requestId: z.number().optional(),
  workspaceId: z.number().optional(),
  monitorId: z.number().optional(),
  timestamp: z.number(),
  timing: z.object({
    tcpStart: z.number(),
    tcpDone: z.number(),
  }),
  error: z.string().optional(),
  region: monitorFlyRegionSchema,
  latency: z.number().optional(),
});

export type tcpPayload = z.infer<typeof tcpPayload>;
