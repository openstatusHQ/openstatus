import { z } from "zod";

/** Matches the `periods` constant in the existing tRPC router. */
export const monitorIncidentListPeriods = ["1d", "7d", "14d"] as const;
export type MonitorIncidentListPeriod =
  (typeof monitorIncidentListPeriods)[number];
export const monitorIncidentListPeriodSchema = z.enum(
  monitorIncidentListPeriods,
);

export const AcknowledgeMonitorIncidentInput = z.object({
  id: z.number().int(),
});
export type AcknowledgeMonitorIncidentInput = z.infer<
  typeof AcknowledgeMonitorIncidentInput
>;

export const ResolveMonitorIncidentInput = z.object({ id: z.number().int() });
export type ResolveMonitorIncidentInput = z.infer<
  typeof ResolveMonitorIncidentInput
>;

export const ExcuseMonitorIncidentInput = z.object({
  id: z.number().int(),
  reason: z.string().trim().min(1, "A reason is required."),
});
export type ExcuseMonitorIncidentInput = z.infer<
  typeof ExcuseMonitorIncidentInput
>;

export const UnexcuseMonitorIncidentInput = z.object({ id: z.number().int() });
export type UnexcuseMonitorIncidentInput = z.infer<
  typeof UnexcuseMonitorIncidentInput
>;

export const GetMonitorIncidentInput = z.object({ id: z.number().int() });
export type GetMonitorIncidentInput = z.infer<typeof GetMonitorIncidentInput>;

// `limit` unbounded at the schema level — same convention as status-report /
// maintenance. tRPC passes the 10_000 sentinel; external surfaces cap in the
// adapter.
export const ListMonitorIncidentsInput = z.object({
  limit: z.number().int().min(1).default(50),
  offset: z.number().int().min(0).default(0),
  period: monitorIncidentListPeriodSchema.optional(),
  monitorId: z.number().int().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListMonitorIncidentsInput = z.infer<
  typeof ListMonitorIncidentsInput
>;

export const GetMonitorReportInput = z.object({
  monitorId: z.number().int(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type GetMonitorReportInput = z.infer<typeof GetMonitorReportInput>;
