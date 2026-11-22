import {
  type FrozenMonitorUptimeDay,
  frozenMonitorUptimeMonthSchema,
  insertFrozenMonitorUptimeSchema,
  pageCardValues,
} from "@openstatus/db/src/schema";
import { z } from "zod";

// workspaceId comes from ctx; id/createdAt from the db
export const FreezeMonitorMonthInput = insertFrozenMonitorUptimeSchema.omit({
  id: true,
  workspaceId: true,
  createdAt: true,
});
export type FreezeMonitorMonthInput = z.infer<typeof FreezeMonitorMonthInput>;

export const RefreezeMonitorMonthsInput = z.object({
  month: frozenMonitorUptimeMonthSchema,
  monitorIds: z.array(z.number().int().positive()).min(1).max(1000),
});
export type RefreezeMonitorMonthsInput = z.infer<
  typeof RefreezeMonitorMonthsInput
>;

export const BackfillFrozenBucketsInput = z.object({
  month: frozenMonitorUptimeMonthSchema,
  monitorIds: z.array(z.number().int().positive()).min(1).max(1000).optional(),
});
export type BackfillFrozenBucketsInput = z.infer<
  typeof BackfillFrozenBucketsInput
>;

export const AttachFrozenBadRangesInput = z.object({
  id: z.number().int().positive(),
  days: insertFrozenMonitorUptimeSchema.shape.days,
  // matched against the stored JSON, so it must not be reshaped by a parse
  expected: z.custom<FrozenMonitorUptimeDay[]>(Array.isArray),
});
export type AttachFrozenBadRangesInput = z.infer<
  typeof AttachFrozenBadRangesInput
>;

export const GetUptimeHistoryInput = z.object({
  pageId: z.number().int().positive(),
  /** Count under another calculation; omitted, the page's own configuration. */
  mode: z.enum(pageCardValues).optional(),
  /** Months to cover, capped at the plan's; omitted, a year or the plan's if fewer. */
  months: z.number().int().positive().optional(),
});
export type GetUptimeHistoryInput = z.infer<typeof GetUptimeHistoryInput>;

export const GetMonitorUptimeHistoryInput = z.object({
  monitorId: z.number().int().positive(),
});
export type GetMonitorUptimeHistoryInput = z.infer<
  typeof GetMonitorUptimeHistoryInput
>;
