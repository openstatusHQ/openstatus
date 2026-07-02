import { monitorRegionSchema } from "@openstatus/db/src/schema/constants";
import { CACHE_STATUSES, CDN_PROVIDERS } from "@openstatus/header-analysis";
import { z } from "zod";

const cacheStatusSchema = z.enum(CACHE_STATUSES);
const cdnProviderSchema = z.enum(CDN_PROVIDERS);

export const cdnRegionResultSchema = z.object({
  state: z.literal("success").prefault("success"),
  region: monitorRegionSchema,
  cacheStatus: cacheStatusSchema,
  /** `header-name: value` pair that determined the status */
  cacheStatusRaw: z.string().nullable(),
  edgeIp: z.string().nullable(),
  edgePop: z.string().nullable(),
  edgePopLocation: z.string().nullable(),
  ttfbMs: z.number(),
  totalMs: z.number(),
  statusCode: z.number(),
  responseSize: z.number().nullable(),
  age: z.number().nullable(),
  cacheControl: z.string().nullable(),
  etag: z.string().nullable(),
  cdn: cdnProviderSchema.nullable(),
});

const cdnRegionErrorSchema = z.object({
  state: z.literal("error"),
  region: monitorRegionSchema,
  message: z.string(),
});

export const cdnRegionResponseSchema = z.discriminatedUnion("state", [
  cdnRegionResultSchema,
  cdnRegionErrorSchema,
]);

export const cdnSummarySchema = z.object({
  type: z.literal("summary").prefault("summary"),
  totalRegions: z.number(),
  respondedRegions: z.number(),
  cachedRegions: z.number(),
  uncachedRegions: monitorRegionSchema.array(),
  unreachableRegions: monitorRegionSchema.array(),
  cdn: cdnProviderSchema.nullable(),
  /** more than one provider detected across regions (multi-CDN or mixed setup) */
  mixedCdn: z.boolean(),
  topology: z.enum(["anycast", "unicast", "unknown"]),
  topologyBasis: z.enum(["edge-ips", "provider"]).nullable(),
});

export type CdnRegionResult = z.infer<typeof cdnRegionResultSchema>;
export type CdnRegionResponse = z.infer<typeof cdnRegionResponseSchema>;
export type CdnSummary = z.infer<typeof cdnSummarySchema>;
