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
});
export type CreateMonitorInput = z.infer<typeof CreateMonitorInput>;

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

// Bounds mirror `insertMonitorSchema` (0–60_000 ms) — the persisted checker
// timeout is hard-capped at 60 s and rejects negatives.
export const UpdateMonitorResponseTimeInput = z.object({
  id: z.number().int(),
  timeout: z.coerce.number().gte(0).lte(60_000),
  degradedAfter: z.coerce.number().gte(0).lte(60_000).nullish(),
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
