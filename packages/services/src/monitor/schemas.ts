import {
  headerAssertion,
  jsonBodyAssertion,
  recordAssertion,
  statusAssertion,
  textBodyAssertion,
} from "@openstatus/assertions";
import { monitorPeriodicity } from "@openstatus/db/src/schema/constants";
import {
  grpcTlsModes,
  monitorJobTypes,
  monitorMethods,
} from "@openstatus/db/src/schema/monitors/constants";
import { z } from "zod";

export { grpcTlsModes, monitorJobTypes, monitorMethods, monitorPeriodicity };

const headerPair = z.object({ key: z.string(), value: z.string() });
const assertion = z.discriminatedUnion("type", [
  statusAssertion,
  headerAssertion,
  textBodyAssertion,
  jsonBodyAssertion,
  recordAssertion,
]);

// Bounds mirror `insertMonitorSchema` (0–60_000 ms) — what the dashboard
// forms accept.
const timeoutMs = z.coerce.number().gte(0).lte(60_000);

// The RPC API's proto contract declares 0–120_000 ms and validates it there,
// so the whole-object verbs must not reject a value the proto accepts.
const apiTimeoutMs = z.coerce.number().gte(0).lte(120_000);

/**
 * Create a new monitor. Regions and periodicity are optional — when unset,
 * the service picks sensible plan-based defaults (4 free regions / 6 paid
 * + `30m`/`1m` respectively).
 */
export const CreateMonitorInput = z.object({
  name: z.string().trim().min(1),
  jobType: z.enum(monitorJobTypes),
  url: z.string(),
  method: z.enum(monitorMethods),
  headers: z.array(headerPair).default([]),
  body: z.string().optional(),
  assertions: z.array(assertion).default([]),
  active: z.boolean().default(false),
  periodicity: z.enum(monitorPeriodicity).optional(),
  regions: z.array(z.string()).optional(),
  // Config fields below are omitted by the dashboard create form and set
  // by the public API. Each stays `undefined` when unset so the insert
  // falls through to the column default rather than overwriting it.
  description: z.string().optional(),
  public: z.boolean().optional(),
  timeout: apiTimeoutMs.optional(),
  degradedAfter: apiTimeoutMs.nullish(),
  retry: z.number().int().min(0).optional(),
  followRedirects: z.boolean().optional(),
  grpcService: z.string().optional(),
  grpcTls: z.enum(grpcTlsModes).optional(),
  otelEndpoint: z.string().optional(),
  otelHeaders: z.array(headerPair).optional(),
});
export type CreateMonitorInput = z.infer<typeof CreateMonitorInput>;

/**
 * Whole-object monitor patch backing the public API's update surface.
 * Every field is optional and `undefined` means "leave as-is", so one
 * request produces one UPDATE and one audit row — the granular verbs
 * below stay for the dashboard's per-section forms.
 *
 * `jobType` is absent by design: callers address a monitor through a
 * type-specific method that has already asserted the stored type.
 */
export const UpdateMonitorConfigInput = z.object({
  id: z.number().int(),
  name: z.string().trim().min(1).optional(),
  url: z.string().optional(),
  method: z.enum(monitorMethods).optional(),
  headers: z.array(headerPair).optional(),
  body: z.string().optional(),
  assertions: z.array(assertion).optional(),
  active: z.boolean().optional(),
  periodicity: z.enum(monitorPeriodicity).optional(),
  regions: z.array(z.string()).optional(),
  description: z.string().optional(),
  public: z.boolean().optional(),
  timeout: apiTimeoutMs.optional(),
  degradedAfter: apiTimeoutMs.nullish(),
  retry: z.number().int().min(0).optional(),
  followRedirects: z.boolean().optional(),
  grpcService: z.string().optional(),
  grpcTls: z.enum(grpcTlsModes).optional(),
  otelEndpoint: z.string().optional(),
  otelHeaders: z.array(headerPair).optional(),
});
export type UpdateMonitorConfigInput = z.infer<typeof UpdateMonitorConfigInput>;

/** Update the "general" monitor payload — name / endpoint / headers / assertions. */
export const UpdateMonitorGeneralInput = z.object({
  id: z.number().int(),
  name: z.string().trim().min(1),
  jobType: z.enum(monitorJobTypes),
  url: z.string(),
  method: z.enum(monitorMethods),
  headers: z.array(headerPair).default([]),
  body: z.string().optional(),
  assertions: z.array(assertion).default([]),
  active: z.boolean().default(true),
  // gRPC-only fields. `undefined` leaves the stored value untouched so a
  // caller that omits them (e.g. an HTTP monitor) never clears the column.
  grpcService: z.string().optional(),
  grpcTls: z.enum(grpcTlsModes).optional(),
});
export type UpdateMonitorGeneralInput = z.infer<
  typeof UpdateMonitorGeneralInput
>;

export const UpdateMonitorRetryInput = z.object({
  id: z.number().int(),
  retry: z.number().int(),
});
export type UpdateMonitorRetryInput = z.infer<typeof UpdateMonitorRetryInput>;

export const UpdateMonitorFollowRedirectsInput = z.object({
  id: z.number().int(),
  followRedirects: z.boolean(),
});
export type UpdateMonitorFollowRedirectsInput = z.infer<
  typeof UpdateMonitorFollowRedirectsInput
>;

export const UpdateMonitorOtelInput = z.object({
  id: z.number().int(),
  otelEndpoint: z.string(),
  otelHeaders: z.array(headerPair).optional(),
});
export type UpdateMonitorOtelInput = z.infer<typeof UpdateMonitorOtelInput>;

export const UpdateMonitorPublicInput = z.object({
  id: z.number().int(),
  public: z.boolean(),
});
export type UpdateMonitorPublicInput = z.infer<typeof UpdateMonitorPublicInput>;

export const UpdateMonitorResponseTimeInput = z.object({
  id: z.number().int(),
  timeout: timeoutMs,
  degradedAfter: timeoutMs.nullish(),
});
export type UpdateMonitorResponseTimeInput = z.infer<
  typeof UpdateMonitorResponseTimeInput
>;

export const UpdateMonitorSchedulingRegionsInput = z.object({
  id: z.number().int(),
  regions: z.array(z.string()),
  periodicity: z.enum(monitorPeriodicity),
  privateLocations: z.array(z.number().int()).default([]),
});
export type UpdateMonitorSchedulingRegionsInput = z.infer<
  typeof UpdateMonitorSchedulingRegionsInput
>;

export const UpdateMonitorTagsInput = z.object({
  id: z.number().int(),
  tags: z.array(z.number().int()),
});
export type UpdateMonitorTagsInput = z.infer<typeof UpdateMonitorTagsInput>;

export const UpdateMonitorNotifiersInput = z.object({
  id: z.number().int(),
  notifiers: z.array(z.number().int()),
});
export type UpdateMonitorNotifiersInput = z.infer<
  typeof UpdateMonitorNotifiersInput
>;

/** Batched toggle of `public` / `active` across multiple monitors. */
export const BulkUpdateMonitorsInput = z.object({
  ids: z.array(z.number().int()).min(1),
  public: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type BulkUpdateMonitorsInput = z.infer<typeof BulkUpdateMonitorsInput>;

export const DeleteMonitorInput = z.object({ id: z.number().int() });
export type DeleteMonitorInput = z.infer<typeof DeleteMonitorInput>;

export const DeleteMonitorsInput = z.object({
  ids: z.array(z.number().int()).min(1),
});
export type DeleteMonitorsInput = z.infer<typeof DeleteMonitorsInput>;

export const TriggerMonitorInput = z.object({ id: z.number().int() });
export type TriggerMonitorInput = z.infer<typeof TriggerMonitorInput>;

export const CloneMonitorInput = z.object({ id: z.number().int() });
export type CloneMonitorInput = z.infer<typeof CloneMonitorInput>;

export const GetMonitorInput = z.object({ id: z.number().int() });
export type GetMonitorInput = z.infer<typeof GetMonitorInput>;

export const ListMonitorsInput = z.object({
  limit: z.number().int().min(1).default(50),
  offset: z.number().int().min(0).default(0),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListMonitorsInput = z.infer<typeof ListMonitorsInput>;

export const monitorTimeRange = ["1d", "7d", "14d"] as const;
export type MonitorTimeRange = (typeof monitorTimeRange)[number];

export const GetMonitorStatusInput = z.object({
  monitorId: z.number().int(),
});
export type GetMonitorStatusInput = z.infer<typeof GetMonitorStatusInput>;

export const GetMonitorSummaryInput = z.object({
  monitorId: z.number().int(),
  timeRange: z.enum(monitorTimeRange).default("1d"),
  regions: z.array(z.string()).optional(),
});
export type GetMonitorSummaryInput = z.infer<typeof GetMonitorSummaryInput>;

export const ListResponseLogsInput = z.object({
  monitorId: z.number().int(),
  fromTimestamp: z.number().int().optional(),
  toTimestamp: z.number().int().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});
export type ListResponseLogsInput = z.infer<typeof ListResponseLogsInput>;

export const GetResponseLogInput = z.object({
  monitorId: z.number().int(),
  logId: z.string().min(1),
});
export type GetResponseLogInput = z.infer<typeof GetResponseLogInput>;

/**
 * Filters the v2 response-log pipes evaluate server-side. Every array is bounded:
 * they are templated straight into the pipes' `IN (...)` lists and serialised
 * into the request URL, so an unbounded one is caller-controlled work.
 */
export const ResponseLogFilters = z.object({
  regions: z.array(z.string().max(64)).max(128).optional(),
  status: z
    .array(z.enum(["success", "error", "degraded"]))
    .max(3)
    .optional(),
  trigger: z
    .array(z.enum(["cron", "api"]))
    .max(2)
    .optional(),
  // The pipes cast this list to `Int16`, matching the column: a value outside
  // that range makes Tinybird fail the query rather than match nothing.
  statusCodes: z.array(z.number().int().min(0).max(32_767)).max(100).optional(),
  latencyMin: z.number().int().min(0).optional(),
  latencyMax: z.number().int().min(0).optional(),
});
export type ResponseLogFilters = z.infer<typeof ResponseLogFilters>;

export const ListResponseLogsInfiniteInput = ResponseLogFilters.extend({
  monitorId: z.number().int(),
  fromTimestamp: z.number().int().optional(),
  toTimestamp: z.number().int().optional(),
  /** `cronTimestamp` boundary of the previous page, exclusive. */
  cursor: z.number().int().optional(),
  direction: z.enum(["next", "prev"]).default("next"),
  limit: z.number().int().min(1).max(100).default(50),
});
export type ListResponseLogsInfiniteInput = z.infer<
  typeof ListResponseLogsInfiniteInput
>;

export const GetResponseLogFacetsInput = ResponseLogFilters.extend({
  monitorId: z.number().int(),
  fromTimestamp: z.number().int().optional(),
  toTimestamp: z.number().int().optional(),
});
export type GetResponseLogFacetsInput = z.infer<
  typeof GetResponseLogFacetsInput
>;

export const GetPrivateLocationIdsByMonitorInput = z.object({
  monitorIds: z.array(z.number().int()),
});
export type GetPrivateLocationIdsByMonitorInput = z.infer<
  typeof GetPrivateLocationIdsByMonitorInput
>;
