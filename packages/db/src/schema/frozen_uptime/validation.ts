import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { frozenMonitorUptime } from "./frozen_monitor_uptime";

export const frozenMonitorUptimeDaySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD"), // UTC
  ok: z.number().int().nonnegative(),
  degraded: z.number().int().nonnegative(),
  error: z.number().int().nonnegative(),
});
export type FrozenMonitorUptimeDay = z.infer<
  typeof frozenMonitorUptimeDaySchema
>;

// YYYY-MM-01, UTC first-of-month
export const frozenMonitorUptimeMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, "month must be YYYY-MM-01");

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
