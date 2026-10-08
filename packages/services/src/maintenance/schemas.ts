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

// `z.coerce.date()` turns `null` into 1970-01-01; reject it before coercing.
const coercedDate = z
  .union([z.string(), z.number(), z.date()])
  .pipe(z.coerce.date());

// Timeline updates record what happened; the skew tolerates client clocks.
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const pastDate = coercedDate.refine(
  (date) => date.getTime() <= Date.now() + CLOCK_SKEW_MS,
  { error: "Date cannot be in the future." },
);

export const CreateMaintenanceInput = z
  .object({
    title: z.string().trim().min(1).max(256),
    /** Becomes the first timeline update. */
    message: z.string().min(1),
    /** Date of the first update; defaults to now, must not be in the future. */
    date: pastDate.optional(),
    from: coercedDate,
    to: coercedDate,
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
  title: z.string().trim().min(1).max(256).optional(),
  /** Rewrites the newest timeline update. */
  message: z.string().min(1).optional(),
  from: coercedDate.optional(),
  to: coercedDate.optional(),
  /** When provided, replaces the full association set (empty array clears). */
  pageComponentIds: z.array(z.number().int()).optional(),
});
export type UpdateMaintenanceInput = z.infer<typeof UpdateMaintenanceInput>;

export const AddMaintenanceUpdateInput = z.object({
  maintenanceId: z.number().int(),
  message: z.string().min(1),
  date: pastDate.optional(),
});
export type AddMaintenanceUpdateInput = z.infer<
  typeof AddMaintenanceUpdateInput
>;

export const UpdateMaintenanceUpdateInput = z
  .object({
    id: z.number().int(),
    message: z.string().min(1).optional(),
    date: pastDate.optional(),
  })
  .refine((input) => input.message !== undefined || input.date !== undefined, {
    message: "At least one field must be provided.",
  });
export type UpdateMaintenanceUpdateInput = z.infer<
  typeof UpdateMaintenanceUpdateInput
>;

export const DeleteMaintenanceUpdateInput = z.object({
  id: z.number().int(),
});
export type DeleteMaintenanceUpdateInput = z.infer<
  typeof DeleteMaintenanceUpdateInput
>;

export const GetMaintenanceUpdateInput = z.object({
  id: z.number().int(),
});
export type GetMaintenanceUpdateInput = z.infer<
  typeof GetMaintenanceUpdateInput
>;

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

export const NotifyMaintenanceUpdateInput = z.object({
  maintenanceUpdateId: z.number().int(),
});
export type NotifyMaintenanceUpdateInput = z.infer<
  typeof NotifyMaintenanceUpdateInput
>;
