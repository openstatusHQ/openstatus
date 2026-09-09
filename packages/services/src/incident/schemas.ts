import {
  incidentOriginSchema,
  incidentSeveritySchema,
  incidentStatusSchema,
} from "@openstatus/db/src/schema";
import { z } from "zod";

export { incidentOriginSchema, incidentSeveritySchema, incidentStatusSchema };

export const incidentListPeriods = ["1d", "7d", "14d", "30d"] as const;
export type IncidentListPeriod = (typeof incidentListPeriods)[number];
export const incidentListPeriodSchema = z.enum(incidentListPeriods);

export const CreateIncidentInput = z.object({
  title: z.string().trim().min(1).max(256),
  summary: z.string().default(""),
  severity: incidentSeveritySchema.default("warning"),
  origin: incidentOriginSchema,
  startedAt: z.coerce.date().optional(),
  fingerprint: z.string().min(1).optional(),
  alertSourceId: z.number().int().optional(),
});
export type CreateIncidentInput = z.infer<typeof CreateIncidentInput>;

export const UpdateIncidentInput = z.object({
  id: z.number().int(),
  title: z.string().trim().min(1).max(256).optional(),
  summary: z.string().optional(),
  status: incidentStatusSchema.optional(),
  severity: incidentSeveritySchema.optional(),
});
export type UpdateIncidentInput = z.infer<typeof UpdateIncidentInput>;

export const AcknowledgeIncidentInput = z.object({ id: z.number().int() });
export type AcknowledgeIncidentInput = z.infer<typeof AcknowledgeIncidentInput>;

export const ResolveIncidentInput = z.object({ id: z.number().int() });
export type ResolveIncidentInput = z.infer<typeof ResolveIncidentInput>;

export const DeleteIncidentInput = z.object({ id: z.number().int() });
export type DeleteIncidentInput = z.infer<typeof DeleteIncidentInput>;

export const GetIncidentInput = z.object({ id: z.number().int() });
export type GetIncidentInput = z.infer<typeof GetIncidentInput>;

export const ListIncidentsInput = z.object({
  period: incidentListPeriodSchema.optional(),
  status: incidentStatusSchema.optional(),
  origin: incidentOriginSchema.optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().positive().max(10_000).default(100),
  offset: z.number().int().min(0).default(0),
});
export type ListIncidentsInput = z.infer<typeof ListIncidentsInput>;

export const LinkMonitorIncidentInput = z.object({
  incidentId: z.number().int(),
  monitorIncidentId: z.number().int(),
});
export type LinkMonitorIncidentInput = z.infer<typeof LinkMonitorIncidentInput>;

export const PromoteIncidentInput = z.object({
  id: z.number().int(),
  pageId: z.number().int(),
  pageComponentIds: z.array(z.number().int()).default([]),
  message: z.string().min(1),
  date: z.coerce.date().optional(),
});
export type PromoteIncidentInput = z.infer<typeof PromoteIncidentInput>;
