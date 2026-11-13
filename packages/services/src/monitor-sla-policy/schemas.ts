import {
  MONITOR_SLA_EXCUSED_REASON_MAX,
  MONITOR_SLA_EXCUSED_WINDOW_MAX_MS,
  MONITOR_SLA_TARGET_MAX,
  MONITOR_SLA_TARGET_MIN,
  monitorSlaExcusedWindowKinds,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { z } from "zod";

import { isValidTimeZone } from "./months";

const timeZone = z
  .string()
  .trim()
  .refine(isValidTimeZone, "Expected an IANA time zone, e.g. Europe/Berlin.");

export const CreateMonitorSlaPolicyInput = z.object({
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
export type CreateMonitorSlaPolicyInput = z.input<
  typeof CreateMonitorSlaPolicyInput
>;

/** Omitted fields stay as they are; `monitorIds` replaces the whole set; new terms apply from next month. */
export const UpdateMonitorSlaPolicyInput = z.object({
  id: z.number().int().positive(),
  name: CreateMonitorSlaPolicyInput.shape.name.optional(),
  target: CreateMonitorSlaPolicyInput.shape.target.optional(),
  strict: z.boolean().optional(),
  timeZone: timeZone.optional(),
  monitorIds: z.array(z.number().int()).optional(),
});
export type UpdateMonitorSlaPolicyInput = z.input<
  typeof UpdateMonitorSlaPolicyInput
>;

export const MonitorSlaPolicyIdInput = z.object({
  id: z.number().int().positive(),
});
export type MonitorSlaPolicyIdInput = z.input<typeof MonitorSlaPolicyIdInput>;

export const ListMonitorSlaPoliciesInput = z.object({
  /** true lists only archived policies; the default list leaves them out. */
  archived: z.boolean().default(false),
});
export type ListMonitorSlaPoliciesInput = z.input<
  typeof ListMonitorSlaPoliciesInput
>;

export const GetMonitorSlaPolicyInput = z.object({
  id: z.number().int().positive(),
  months: z.union([z.literal(12), z.literal(24)]).default(12),
});
export type GetMonitorSlaPolicyInput = z.input<typeof GetMonitorSlaPolicyInput>;

const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected a month as YYYY-MM");

/** One policy member's month (YYYY-MM in the policy zone); defaults to the running month. */
export const GetMonitorSlaMonitorMonthInput = z.object({
  id: z.number().int().positive(),
  monitorId: z.number().int().positive(),
  month: yearMonth.optional(),
});
export type GetMonitorSlaMonitorMonthInput = z.input<
  typeof GetMonitorSlaMonitorMonthInput
>;

/** Inclusive month range; defaults to the last twelve complete months. */
export const ExportMonitorSlaPolicyInput = z.object({
  id: z.number().int().positive(),
  from: yearMonth.optional(),
  to: yearMonth.optional(),
  includeLive: z.boolean().default(false),
});
export type ExportMonitorSlaPolicyInput = z.input<
  typeof ExportMonitorSlaPolicyInput
>;

// `z.coerce.date()` turns `null` into 1970-01-01; reject it before coercing
const instant = z
  .union([z.string(), z.number(), z.date()])
  .pipe(z.coerce.date());

export const AddMonitorSlaExcusedWindowInput = z
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
export type AddMonitorSlaExcusedWindowInput = z.input<
  typeof AddMonitorSlaExcusedWindowInput
>;

export const GetMonitorSlaExcusedWindowInput = z.object({
  id: z.number().int().positive(),
});
export type GetMonitorSlaExcusedWindowInput = z.input<
  typeof GetMonitorSlaExcusedWindowInput
>;

export const RemoveMonitorSlaExcusedWindowInput = z.object({
  id: z.number().int().positive(),
});
export type RemoveMonitorSlaExcusedWindowInput = z.input<
  typeof RemoveMonitorSlaExcusedWindowInput
>;
