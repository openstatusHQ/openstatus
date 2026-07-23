import { z } from "zod";

/** Matches the `periods` constant in the existing tRPC router. */
export const incidentListPeriods = ["1d", "7d", "14d"] as const;
export type IncidentListPeriod = (typeof incidentListPeriods)[number];
export const incidentListPeriodSchema = z.enum(incidentListPeriods);

export const AcknowledgeIncidentInput = z.object({ id: z.number().int() });
export type AcknowledgeIncidentInput = z.infer<typeof AcknowledgeIncidentInput>;

export const ResolveIncidentInput = z.object({ id: z.number().int() });
export type ResolveIncidentInput = z.infer<typeof ResolveIncidentInput>;

export const DeleteIncidentInput = z.object({ id: z.number().int() });
export type DeleteIncidentInput = z.infer<typeof DeleteIncidentInput>;

export const GetIncidentInput = z.object({ id: z.number().int() });
export type GetIncidentInput = z.infer<typeof GetIncidentInput>;

// `limit` unbounded at the schema level — same convention as status-report /
// maintenance. tRPC passes the 10_000 sentinel; external surfaces cap in the
// adapter.
export const ListIncidentsInput = z.object({
  limit: z.number().int().min(1).default(50),
  offset: z.number().int().min(0).default(0),
  period: incidentListPeriodSchema.optional(),
  monitorId: z.number().int().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListIncidentsInput = z.infer<typeof ListIncidentsInput>;
