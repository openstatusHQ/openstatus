import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { frozenMonitorUptime } from "./frozen_monitor_uptime";
import { frozenMonitorUptimeMonthSchema } from "./month";

const countsSchema = z.object({
  ok: z.number().int().nonnegative(),
  degraded: z.number().int().nonnegative(),
  error: z.number().int().nonnegative(),
});

const count = z.number().int().nonnegative();

// [firstBucket, count, degraded, error]: `count` consecutive UTC quarter-hours,
// each with exactly these counts. Buckets are 0..95; 0 is 00:00–00:15 UTC.
export const badRangeSchema = z
  .tuple([
    z.number().int().min(0).max(95),
    z.number().int().min(1),
    count,
    count,
  ])
  .refine(([first, n]) => first + n <= 96, "range must end within the day");
export type BadRange = z.infer<typeof badRangeSchema>;

export const frozenMonitorUptimeDaySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD"), // UTC
  requests: countsSchema,
  // run verdicts under the region quorum, absent when the day has none
  runs: countsSchema.optional(),
  // only the failing quarter-hours; absent on a day without failures
  bad: z
    .object({
      requests: badRangeSchema.array().optional(),
      runs: badRangeSchema.array().optional(),
    })
    .optional(),
});
export type FrozenMonitorUptimeDay = z.infer<
  typeof frozenMonitorUptimeDaySchema
>;

export const selectFrozenMonitorUptimeSchema = createSelectSchema(
  frozenMonitorUptime,
  {
    days: frozenMonitorUptimeDaySchema.array(),
    month: frozenMonitorUptimeMonthSchema,
  },
);
export type FrozenMonitorUptime = z.infer<
  typeof selectFrozenMonitorUptimeSchema
>;

export const insertFrozenMonitorUptimeSchema = createInsertSchema(
  frozenMonitorUptime,
  {
    days: frozenMonitorUptimeDaySchema.array(),
    month: frozenMonitorUptimeMonthSchema,
  },
);
export type InsertFrozenMonitorUptime = z.infer<
  typeof insertFrozenMonitorUptimeSchema
>;
