import {
  UPTIME_TARGET_EXCUSED_REASON_MAX,
  UPTIME_TARGET_EXCUSED_WINDOW_MAX_MS,
  UPTIME_TARGET_TARGET_MAX,
  UPTIME_TARGET_TARGET_MIN,
  uptimeTargetExcusedWindowKinds,
} from "@openstatus/db/src/schema/uptime_targets/constants";
import { z } from "zod";

import { canonicalTimeZone } from "./months";

const timeZone = z.string().transform((value, ctx) => {
  const zone = canonicalTimeZone(value);
  if (zone === null) {
    ctx.addIssue({
      code: "custom",
      message: "Expected an IANA time zone, e.g. Europe/Berlin.",
    });
    return z.NEVER;
  }
  return zone;
});

export const CreateUptimeTargetInput = z.object({
  name: z.string().trim().min(1).max(256),
  /** Thousandths of a percent: 99.5% is 99500. */
  target: z
    .number()
    .int()
    .min(UPTIME_TARGET_TARGET_MIN)
    .max(UPTIME_TARGET_TARGET_MAX),
  strict: z.boolean().default(false),
  /** IANA zone whose calendar months the policy judges; locked once a month is sealed. */
  timeZone: timeZone.default("UTC"),
  monitorIds: z.array(z.number().int()).default([]),
});
export type CreateUptimeTargetInput = z.input<typeof CreateUptimeTargetInput>;

/** Omitted fields stay as they are; `monitorIds` replaces the whole set. */
export const UpdateUptimeTargetInput = z.object({
  id: z.number().int().positive(),
  name: CreateUptimeTargetInput.shape.name.optional(),
  target: CreateUptimeTargetInput.shape.target.optional(),
  strict: z.boolean().optional(),
  timeZone: timeZone.optional(),
  monitorIds: z.array(z.number().int()).optional(),
});
export type UpdateUptimeTargetInput = z.input<typeof UpdateUptimeTargetInput>;

export const UptimeTargetIdInput = z.object({
  id: z.number().int().positive(),
});
export type UptimeTargetIdInput = z.input<typeof UptimeTargetIdInput>;

export const ListUptimeTargetsInput = z.object({
  /** true lists only archived policies; the default list leaves them out. */
  archived: z.boolean().default(false),
});
export type ListUptimeTargetsInput = z.input<typeof ListUptimeTargetsInput>;

export const ListUptimeTargetsForMonitorInput = z.object({
  monitorId: z.number().int().positive(),
});
export type ListUptimeTargetsForMonitorInput = z.input<
  typeof ListUptimeTargetsForMonitorInput
>;

export const GetUptimeTargetInput = z.object({
  id: z.number().int().positive(),
  months: z.union([z.literal(12), z.literal(24)]).default(12),
});
export type GetUptimeTargetInput = z.input<typeof GetUptimeTargetInput>;

const yearMonth = z
  .string()
  // years below 0100 are refused: Date.UTC maps 0-99 to 1900-1999
  .regex(/^(?!00)\d{4}-(0[1-9]|1[0-2])$/, "Expected a month as YYYY-MM");

/** One policy member's month (YYYY-MM in the policy zone); defaults to the running month. */
export const GetUptimeTargetMonthInput = z.object({
  id: z.number().int().positive(),
  monitorId: z.number().int().positive(),
  month: yearMonth.optional(),
});
export type GetUptimeTargetMonthInput = z.input<
  typeof GetUptimeTargetMonthInput
>;

/** Inclusive month range; defaults to the last twelve complete months. */
export const ExportUptimeTargetInput = z.object({
  id: z.number().int().positive(),
  from: yearMonth.optional(),
  to: yearMonth.optional(),
  includeLive: z.boolean().default(false),
});
export type ExportUptimeTargetInput = z.input<typeof ExportUptimeTargetInput>;

// `z.coerce.date()` turns `null` into 1970-01-01; reject it before coercing
const instant = z
  .union([z.string(), z.number(), z.date()])
  .pipe(z.coerce.date());

export const AddUptimeTargetExcusedWindowInput = z
  .object({
    policyId: z.number().int().positive(),
    kind: z.enum(uptimeTargetExcusedWindowKinds),
    reason: z.string().trim().min(1).max(UPTIME_TARGET_EXCUSED_REASON_MAX),
    from: instant,
    to: instant,
    /** policy members to excuse */
    monitorIds: z
      .array(z.number().int().positive())
      .min(1, "Pick at least one monitor.")
      .transform((ids) => [...new Set(ids)].sort((a, b) => a - b)),
    /** provenance only: the maintenance window it was prefilled from */
    monitorMaintenanceWindowId: z.number().int().positive().optional(),
  })
  .refine((w) => w.from < w.to, {
    message: "The window must end after it starts.",
    path: ["to"],
  })
  .refine(
    (w) =>
      w.to.getTime() - w.from.getTime() <= UPTIME_TARGET_EXCUSED_WINDOW_MAX_MS,
    { message: "A window lasts at most 7 days.", path: ["to"] },
  );
export type AddUptimeTargetExcusedWindowInput = z.input<
  typeof AddUptimeTargetExcusedWindowInput
>;

export const PreviewUptimeTargetExcusedWindowInput = z
  .object({
    policyId: z.number().int().positive(),
    from: instant,
    to: instant,
  })
  .refine((w) => w.from < w.to, {
    message: "The window must end after it starts.",
    path: ["to"],
  })
  .refine(
    (w) =>
      w.to.getTime() - w.from.getTime() <= UPTIME_TARGET_EXCUSED_WINDOW_MAX_MS,
    { message: "A window lasts at most 7 days.", path: ["to"] },
  );
export type PreviewUptimeTargetExcusedWindowInput = z.input<
  typeof PreviewUptimeTargetExcusedWindowInput
>;

export const GetUptimeTargetExcusedWindowInput = z.object({
  id: z.number().int().positive(),
});
export type GetUptimeTargetExcusedWindowInput = z.input<
  typeof GetUptimeTargetExcusedWindowInput
>;

export const RemoveUptimeTargetExcusedWindowInput = z.object({
  id: z.number().int().positive(),
});
export type RemoveUptimeTargetExcusedWindowInput = z.input<
  typeof RemoveUptimeTargetExcusedWindowInput
>;
