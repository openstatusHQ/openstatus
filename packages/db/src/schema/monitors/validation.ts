import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import * as assertions from "@openstatus/assertions";

import { monitorPeriodicitySchema, monitorRegionSchema } from "../constants";
import { monitorJobTypes, monitorMethods, monitorStatus } from "./constants";
import { monitor, monitorsToPages } from "./monitor";

export const monitorMethodsSchema = z.enum(monitorMethods);
export const monitorStatusSchema = z.enum(monitorStatus);
export const monitorJobTypesSchema = z.enum(monitorJobTypes);

// TODO: shared function
// biome-ignore lint/correctness/noUnusedVariables: <explanation>
function stringToArrayProcess<T>(_string: T) {}

const regionsToArraySchema = z.preprocess((val) => {
  if (String(val).length > 0) {
    return String(val).split(",");
  }
  return [];
}, z.array(monitorRegionSchema));

const bodyToStringSchema = z.preprocess((val) => {
  return String(val);
}, z.string());

const headersToArraySchema = z.preprocess(
  (val) => {
    // early return in case the header is already an array
    if (Array.isArray(val)) {
      return val;
    }
    if (typeof val === "string" && String(val).length > 0) {
      return JSON.parse(String(val));
    }
    return [];
  },
  z.array(z.object({ key: z.string(), value: z.string() })).prefault([]),
);

export const selectMonitorSchema = createSelectSchema(monitor, {
  periodicity: monitorPeriodicitySchema.prefault("10m"),
  status: monitorStatusSchema.prefault("active"),
  jobType: monitorJobTypesSchema.prefault("http"),
  timeout: z.number().prefault(45),
  followRedirects: z.boolean().prefault(true),
  retry: z.number().prefault(3),
  regions: regionsToArraySchema.prefault([]),
}).extend({
  headers: headersToArraySchema.prefault([]),
  otelHeaders: headersToArraySchema.prefault([]),
  body: bodyToStringSchema.prefault(""),
  // for tcp monitors the method is not needed
  method: monitorMethodsSchema.prefault("GET"),
});

const headersSchema = z
  .array(z.object({ key: z.string(), value: z.string() }))
  .optional();

export const insertMonitorSchema = createInsertSchema(monitor, {
  name: z
    .string()
    .min(1, "Name must be at least 1 character long")
    .max(255, "Name must be at most 255 characters long"),
  periodicity: monitorPeriodicitySchema.prefault("10m"),
  status: monitorStatusSchema.prefault("active"),
  regions: z.array(monitorRegionSchema).prefault([]).optional(),
  headers: headersSchema.prefault([]),
  otelHeaders: headersSchema.prefault([]),
}).extend({
  method: monitorMethodsSchema.prefault("GET"),
  notifications: z.array(z.number()).optional().prefault([]),
  pages: z.array(z.number()).optional().prefault([]),
  body: z.string().prefault("").optional(),
  tags: z.array(z.number()).optional().prefault([]),
  statusAssertions: z.array(assertions.statusAssertion).optional(),
  headerAssertions: z.array(assertions.headerAssertion).optional(),
  textBodyAssertions: z.array(assertions.textBodyAssertion).optional(),
  timeout: z.coerce.number().gte(0).lte(60000).prefault(45000),
  degradedAfter: z.coerce.number().gte(0).lte(60000).nullish(),
});

/**
 * @deprecated Use `selectPageComponentSchema` from `@openstatus/db/src/schema/page_components/validation` instead.
 * Retained for backwards compatibility during migration.
 */
export const selectMonitorToPageSchema = createSelectSchema(monitorsToPages);

export type InsertMonitor = z.infer<typeof insertMonitorSchema>;
export type Monitor = z.infer<typeof selectMonitorSchema>;
/**
 * @deprecated Use `SelectPageComponent` from `@openstatus/db/src/schema/page_components/validation` instead.
 */
export type MonitorToPage = z.infer<typeof selectMonitorToPageSchema>;
export type MonitorStatus = z.infer<typeof monitorStatusSchema>;
export type MonitorPeriodicity = z.infer<typeof monitorPeriodicitySchema>;
export type MonitorMethod = z.infer<typeof monitorMethodsSchema>;
export type MonitorRegion = z.infer<typeof monitorRegionSchema>;
export type MonitorJobType = z.infer<typeof monitorJobTypesSchema>;
