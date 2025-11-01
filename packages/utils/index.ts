import { base } from "@openstatus/assertions";
import { monitorMethods, monitorStatus } from "@openstatus/db/src/schema";

import { z } from "zod";

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
  trigger: z.enum(["cron", "api"]).optional().nullable().default("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string()),
    })
    .optional(),
  retry: z.number().default(3),
  followRedirects: z.boolean().default(true),
});

export type HttpPayload = z.infer<typeof httpPayloadSchema>;

export const tpcPayloadSchema = z.object({
  status: z.enum(monitorStatus),
  workspaceId: z.string(),
  uri: z.string(),
  monitorId: z.string(),
  assertions: z.array(base).nullable(),
  cronTimestamp: z.number(),
  timeout: z.number().default(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().default("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string()),
    })
    .optional(),
  retry: z.number().default(3),
});

export type TcpPayload = z.infer<typeof tpcPayloadSchema>;


export const DNSPayloadSchema = z.object({
  status: z.enum(monitorStatus),
  workspaceId: z.string(),
  uri: z.string(),
  monitorId: z.string(),
  assertions: z.array(base).nullable(),
  cronTimestamp: z.number(),
  timeout: z.number().default(45000),
  degradedAfter: z.number().nullable(),
  trigger: z.enum(["cron", "api"]).optional().nullable().default("cron"),
  otelConfig: z
    .object({
      endpoint: z.string(),
      headers: z.record(z.string()),
    })
    .optional(),
  retry: z.number().default(3)
});

export type DNSPayload = z.infer<typeof DNSPayloadSchema>;

export function transformHeaders(headers: { key: string; value: string }[]) {
  return headers.length > 0
    ? headers.reduce(
        (acc, curr) => {
          acc[curr.key] = curr.value;
          return acc;
        },
        {} as Record<string, string>,
      )
    : {};
}
