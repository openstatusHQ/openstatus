import { base } from "@openstatus/assertions";
import { MONITOR_METHODS, MONITOR_STATUSES } from "./constants";

import { z } from "zod";

export const httpPayloadSchema = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  method: z.enum(MONITOR_METHODS),
  body: z.string().optional(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  url: z.string(),
  cronTimestamp: z.number(),
  status: z.enum(MONITOR_STATUSES),
  assertions: z.array(base).nullable(),
  timeout: z.number().prefault(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().prefault("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string(), z.string()),
    })
    .optional(),
  retry: z.number().prefault(3),
  followRedirects: z.boolean().prefault(true),
});

export type HttpPayload = z.infer<typeof httpPayloadSchema>;

export const tpcPayloadSchema = z.object({
  status: z.enum(MONITOR_STATUSES),
  workspaceId: z.string(),
  uri: z.string(),
  monitorId: z.string(),
  assertions: z.array(base).nullable(),
  cronTimestamp: z.number(),
  timeout: z.number().prefault(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().prefault("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string(), z.string()),
    })
    .optional(),
  retry: z.number().prefault(3),
});

export type TcpPayload = z.infer<typeof tpcPayloadSchema>;

export const DNSPayloadSchema = z.object({
  status: z.enum(MONITOR_STATUSES),
  workspaceId: z.string(),
  uri: z.string(),
  monitorId: z.string(),
  assertions: z.array(base).nullable(),
  cronTimestamp: z.number(),
  timeout: z.number().prefault(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().prefault("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string(), z.string()),
    })
    .optional(),
  retry: z.number().prefault(3),
});

export type DNSPayload = z.infer<typeof DNSPayloadSchema>;
