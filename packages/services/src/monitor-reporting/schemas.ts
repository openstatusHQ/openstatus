import {
  MONITOR_SLA_EXCUSED_REASON_MAX,
  MONITOR_SLA_EXCUSED_WINDOW_MAX_MS,
  MONITOR_SLA_TARGET_MAX,
  MONITOR_SLA_TARGET_MIN,
  monitorSlaExcusedWindowKinds,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { z } from "zod";

import { SlaPercentInput } from "../schemas";
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

/** Each started `stepPct` below target earns `creditPct` of monthly fees, up to `capPct`. */
export const MonitorSlaCreditScheduleInput = z.object({
  stepPct: SlaPercentInput,
  creditPct: SlaPercentInput,
  capPct: SlaPercentInput,
});

export const CreateMonitorReportingInput = z.object({
  name: z.string().trim().min(1).max(256),
  /** Thousandths of a percent: 99.5% is 99500. */
  target: z
    .number()
    .int()
    .min(MONITOR_SLA_TARGET_MIN)
    .max(MONITOR_SLA_TARGET_MAX),
  strict: z.boolean().default(false),
  /** IANA zone whose calendar months the policy judges; locked once a month is sealed. */
  timeZone: timeZone.default("UTC"),
  monitorIds: z.array(z.number().int()).default([]),
});
export type CreateMonitorReportingInput = z.input<
  typeof CreateMonitorReportingInput
>;

/** Omitted fields stay as they are; `monitorIds` replaces the whole set; new terms (target, strict, creditSchedule) apply from next month. */
export const UpdateMonitorReportingInput = z.object({
  id: z.number().int().positive(),
  name: CreateMonitorReportingInput.shape.name.optional(),
  target: CreateMonitorReportingInput.shape.target.optional(),
  strict: z.boolean().optional(),
  timeZone: timeZone.optional(),
  /** null removes the schedule; versioned with target and strict */
  creditSchedule: MonitorSlaCreditScheduleInput.nullable().optional(),
  /** the workspace's incident policy as support terms; null unlinks, not versioned */
  incidentSlaPolicyId: z.number().int().positive().nullable().optional(),
  monitorIds: z.array(z.number().int()).optional(),
});
export type UpdateMonitorReportingInput = z.input<
  typeof UpdateMonitorReportingInput
>;

export const MonitorReportingIdInput = z.object({
  id: z.number().int().positive(),
});
export type MonitorReportingIdInput = z.input<typeof MonitorReportingIdInput>;

export const ListMonitorReportingsInput = z.object({
  /** true lists only archived policies; the default list leaves them out. */
  archived: z.boolean().default(false),
});
export type ListMonitorReportingsInput = z.input<
  typeof ListMonitorReportingsInput
>;

export const ListMonitorReportingsForMonitorInput = z.object({
  monitorId: z.number().int().positive(),
});
export type ListMonitorReportingsForMonitorInput = z.input<
  typeof ListMonitorReportingsForMonitorInput
>;

export const GetMonitorReportingInput = z.object({
  id: z.number().int().positive(),
  months: z.union([z.literal(12), z.literal(24)]).default(12),
});
export type GetMonitorReportingInput = z.input<typeof GetMonitorReportingInput>;

const yearMonth = z
  .string()
  // years below 0100 are refused: Date.UTC maps 0-99 to 1900-1999
  .regex(/^(?!00)\d{4}-(0[1-9]|1[0-2])$/, "Expected a month as YYYY-MM");

/** One policy member's month (YYYY-MM in the policy zone); defaults to the running month. */
export const GetMonitorReportingMonthInput = z.object({
  id: z.number().int().positive(),
  monitorId: z.number().int().positive(),
  month: yearMonth.optional(),
});
export type GetMonitorReportingMonthInput = z.input<
  typeof GetMonitorReportingMonthInput
>;

/** Inclusive month range; defaults to the last twelve complete months. */
export const ExportMonitorReportingInput = z.object({
  id: z.number().int().positive(),
  from: yearMonth.optional(),
  to: yearMonth.optional(),
  includeLive: z.boolean().default(false),
});
export type ExportMonitorReportingInput = z.input<
  typeof ExportMonitorReportingInput
>;

// `z.coerce.date()` turns `null` into 1970-01-01; reject it before coercing
const instant = z
  .union([z.string(), z.number(), z.date()])
  .pipe(z.coerce.date());

export const AddMonitorReportingExcusedWindowInput = z
  .object({
    policyId: z.number().int().positive(),
    kind: z.enum(monitorSlaExcusedWindowKinds),
    reason: z.string().trim().min(1).max(MONITOR_SLA_EXCUSED_REASON_MAX),
    from: instant,
    to: instant,
  })
  .refine((w) => w.from < w.to, {
    message: "The window must end after it starts.",
    path: ["to"],
  })
  .refine(
    (w) =>
      w.to.getTime() - w.from.getTime() <= MONITOR_SLA_EXCUSED_WINDOW_MAX_MS,
    { message: "A window lasts at most 7 days.", path: ["to"] },
  );
export type AddMonitorReportingExcusedWindowInput = z.input<
  typeof AddMonitorReportingExcusedWindowInput
>;

export const PreviewMonitorReportingExcusedWindowInput = z
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
      w.to.getTime() - w.from.getTime() <= MONITOR_SLA_EXCUSED_WINDOW_MAX_MS,
    { message: "A window lasts at most 7 days.", path: ["to"] },
  );
export type PreviewMonitorReportingExcusedWindowInput = z.input<
  typeof PreviewMonitorReportingExcusedWindowInput
>;

export const GetMonitorReportingExcusedWindowInput = z.object({
  id: z.number().int().positive(),
});
export type GetMonitorReportingExcusedWindowInput = z.input<
  typeof GetMonitorReportingExcusedWindowInput
>;

export const RemoveMonitorReportingExcusedWindowInput = z.object({
  id: z.number().int().positive(),
});
export type RemoveMonitorReportingExcusedWindowInput = z.input<
  typeof RemoveMonitorReportingExcusedWindowInput
>;

/** A monitor's running month under each active reporting covering it. */
export const ListMonitorReportingMonthsInput = z.object({
  monitorId: z.number().int().positive(),
});
export type ListMonitorReportingMonthsInput = z.input<
  typeof ListMonitorReportingMonthsInput
>;
