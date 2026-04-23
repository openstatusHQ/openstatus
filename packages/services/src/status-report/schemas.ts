import { statusReportStatusSchema } from "@openstatus/db/src/schema";
import { z } from "zod";

export { statusReportStatusSchema };
export type StatusReportStatus = z.infer<typeof statusReportStatusSchema>;

/** Periods supported by the status-report list filter — matches tRPC today. */
export const statusReportListPeriods = ["1d", "7d", "14d"] as const;
export type StatusReportListPeriod = (typeof statusReportListPeriods)[number];
export const statusReportListPeriodSchema = z.enum(statusReportListPeriods);

export const CreateStatusReportInput = z.object({
  title: z.string().min(1).max(256),
  status: statusReportStatusSchema,
  message: z.string(),
  date: z.coerce.date(),
  pageId: z.number().int(),
  pageComponentIds: z.array(z.number().int()).default([]),
});
export type CreateStatusReportInput = z.infer<typeof CreateStatusReportInput>;

export const UpdateStatusReportInput = z.object({
  id: z.number().int(),
  title: z.string().min(1).max(256).optional(),
  status: statusReportStatusSchema.optional(),
  /** When provided, replaces the full association set (empty array clears). */
  pageComponentIds: z.array(z.number().int()).optional(),
});
export type UpdateStatusReportInput = z.infer<typeof UpdateStatusReportInput>;

export const AddStatusReportUpdateInput = z.object({
  statusReportId: z.number().int(),
  status: statusReportStatusSchema,
  message: z.string(),
  date: z.coerce.date().optional(),
});
export type AddStatusReportUpdateInput = z.infer<
  typeof AddStatusReportUpdateInput
>;

export const UpdateStatusReportUpdateInput = z.object({
  id: z.number().int(),
  status: statusReportStatusSchema.optional(),
  message: z.string().optional(),
  date: z.coerce.date().optional(),
});
export type UpdateStatusReportUpdateInput = z.infer<
  typeof UpdateStatusReportUpdateInput
>;

export const ResolveStatusReportInput = z.object({
  statusReportId: z.number().int(),
  message: z.string(),
  date: z.coerce.date().optional(),
});
export type ResolveStatusReportInput = z.infer<typeof ResolveStatusReportInput>;

export const DeleteStatusReportInput = z.object({
  id: z.number().int(),
});
export type DeleteStatusReportInput = z.infer<typeof DeleteStatusReportInput>;

export const DeleteStatusReportUpdateInput = z.object({
  id: z.number().int(),
});
export type DeleteStatusReportUpdateInput = z.infer<
  typeof DeleteStatusReportUpdateInput
>;

export const GetStatusReportInput = z.object({
  id: z.number().int(),
});
export type GetStatusReportInput = z.infer<typeof GetStatusReportInput>;

export const ListStatusReportsInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  statuses: z.array(statusReportStatusSchema).default([]),
  pageId: z.number().int().optional(),
  period: statusReportListPeriodSchema.optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListStatusReportsInput = z.infer<typeof ListStatusReportsInput>;

export const NotifyStatusReportInput = z.object({
  statusReportUpdateId: z.number().int(),
});
export type NotifyStatusReportInput = z.infer<typeof NotifyStatusReportInput>;
