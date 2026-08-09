import {
  headerAssertion,
  jsonBodyAssertion,
  recordAssertion,
  statusAssertion,
  textBodyAssertion,
} from "@openstatus/assertions";
import { monitorPeriodicity } from "@openstatus/db/src/schema/constants";
import {
  monitorJobTypes,
  monitorMethods,
} from "@openstatus/db/src/schema/monitors/constants";
import { z } from "zod";

export { monitorJobTypes, monitorMethods, monitorPeriodicity };

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
  name: z.string().min(1),
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
  name: z.string().min(1).optional(),
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
  otelEndpoint: z.string().optional(),
  otelHeaders: z.array(headerPair).optional(),
});
export type UpdateMonitorConfigInput = z.infer<typeof UpdateMonitorConfigInput>;

/** Update the "general" monitor payload — name / endpoint / headers / assertions. */
export const UpdateMonitorGeneralInput = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  jobType: z.enum(monitorJobTypes),
  url: z.string(),
  method: z.enum(monitorMethods),
  headers: z.array(headerPair).default([]),
  body: z.string().optional(),
  assertions: z.array(assertion).default([]),
  active: z.boolean().default(true),
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

export const GetPrivateLocationIdsByMonitorInput = z.object({
  monitorIds: z.array(z.number().int()),
});
export type GetPrivateLocationIdsByMonitorInput = z.infer<
  typeof GetPrivateLocationIdsByMonitorInput
>;
