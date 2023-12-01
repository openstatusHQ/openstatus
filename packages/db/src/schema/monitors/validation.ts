import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import {
  flyRegions,
  monitorJobTypes,
  monitorMethods,
  monitorPeriodicity,
  monitorRegions,
  monitorStatus,
} from "./constants";
import { monitor } from "./monitor";

export const monitorPeriodicitySchema = z.enum(monitorPeriodicity);
export const monitorMethodsSchema = z.enum(monitorMethods);
export const monitorStatusSchema = z.enum(monitorStatus);
export const monitorRegionSchema = z.enum(monitorRegions);
export const monitorJobTypesSchema = z.enum(monitorJobTypes);
export const monitorFlyRegionSchema = z.enum(flyRegions);

// TODO: shared function
function stringToArrayProcess<T>(string: T) {}

const regionsToArraySchema = z.preprocess((val) => {
  if (String(val).length > 0) {
    return String(val).split(",");
  } else {
    return [];
  }
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
    if (String(val).length > 0) {
      return JSON.parse(String(val));
    } else {
      return [];
    }
  },
  z.array(z.object({ key: z.string(), value: z.string() })).default([]),
);

export const selectMonitorSchema = createSelectSchema(monitor, {
  periodicity: monitorPeriodicitySchema.default("10m"),
  status: monitorStatusSchema.default("active"),
  jobType: monitorJobTypesSchema.default("other"),
  regions: regionsToArraySchema.default([]),
}).extend({
  headers: headersToArraySchema.default([]),
  body: bodyToStringSchema.default(""),
  method: monitorMethodsSchema.default("GET"),
});

const headersSchema = z
  .array(z.object({ key: z.string(), value: z.string() }))
  .optional();

export const insertMonitorSchema = createInsertSchema(monitor, {
  periodicity: monitorPeriodicitySchema.default("10m"),
  url: z.string().url(), // find a better way to not always start with "https://" including the `InputWithAddons`
  status: monitorStatusSchema.default("active"),
  regions: z.array(monitorRegionSchema).default([]).optional(),
  headers: headersSchema.default([]),
}).extend({
  method: monitorMethodsSchema.default("GET"),
  notifications: z.array(z.number()).optional().default([]),
  body: z.string().default("").optional(),
});

export type InsertMonitor = z.infer<typeof insertMonitorSchema>;
export type Monitor = z.infer<typeof selectMonitorSchema>;
export type MonitorStatus = z.infer<typeof monitorStatusSchema>;
export type MonitorPeriodicity = z.infer<typeof monitorPeriodicitySchema>;
export type MonitorMethod = z.infer<typeof monitorMethodsSchema>;
export type MonitorRegion = z.infer<typeof monitorRegionSchema>;
export type MonitorFlyRegion = z.infer<typeof monitorFlyRegionSchema>;
export type MonitorJobType = z.infer<typeof monitorJobTypesSchema>;
