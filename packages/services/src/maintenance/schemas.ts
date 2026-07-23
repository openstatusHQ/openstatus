import { z } from "zod";

/**
 * `ListMaintenancesInput.period` mirrors the periods supported by the
 * existing tRPC router. Duplicated from status-report/schemas — a single
 * shared `periods` constant is a worthwhile follow-up once a third domain
 * needs it.
 */
export const maintenanceListPeriods = ["1d", "7d", "14d"] as const;
export type MaintenanceListPeriod = (typeof maintenanceListPeriods)[number];
export const maintenanceListPeriodSchema = z.enum(maintenanceListPeriods);

export const CreateMaintenanceInput = z
  .object({
    title: z.string().min(1).max(256),
    message: z.string().min(1),
    from: z.coerce.date(),
    to: z.coerce.date(),
    pageId: z.number().int(),
    pageComponentIds: z.array(z.number().int()).default([]),
  })
  .refine((v) => v.from < v.to, {
    path: ["to"],
    error: "End date must be after start date.",
  });
export type CreateMaintenanceInput = z.infer<typeof CreateMaintenanceInput>;

export const UpdateMaintenanceInput = z.object({
  id: z.number().int(),
  title: z.string().min(1).max(256).optional(),
  message: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** When provided, replaces the full association set (empty array clears). */
  pageComponentIds: z.array(z.number().int()).optional(),
});
export type UpdateMaintenanceInput = z.infer<typeof UpdateMaintenanceInput>;

export const DeleteMaintenanceInput = z.object({ id: z.number().int() });
export type DeleteMaintenanceInput = z.infer<typeof DeleteMaintenanceInput>;

export const GetMaintenanceInput = z.object({ id: z.number().int() });
export type GetMaintenanceInput = z.infer<typeof GetMaintenanceInput>;

// `limit` is intentionally unbounded at the schema level — matches the
// status-report convention. Connect caps externally; tRPC passes a sentinel.
export const ListMaintenancesInput = z.object({
  limit: z.number().int().min(1).default(50),
  offset: z.number().int().min(0).default(0),
  pageId: z.number().int().optional(),
  period: maintenanceListPeriodSchema.optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ListMaintenancesInput = z.infer<typeof ListMaintenancesInput>;

export const NotifyMaintenanceInput = z.object({
  maintenanceId: z.number().int(),
});
export type NotifyMaintenanceInput = z.infer<typeof NotifyMaintenanceInput>;
