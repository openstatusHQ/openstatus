import { monitorMaintenanceWindowModes } from "@openstatus/db/src/schema/monitor_maintenance_windows/constants";
import { z } from "zod";

// `z.coerce.date()` turns `null` into 1970-01-01; reject it before coercing.
const coercedDate = z
  .union([z.string(), z.number(), z.date()])
  .pipe(z.coerce.date());

const monitorIds = z.array(z.number().int()).min(1, {
  error: "Select at least one monitor.",
});

export const ListMaintenanceWindowsInput = z
  .object({ monitorId: z.number().int().optional() })
  .strict();
export type ListMaintenanceWindowsInput = z.infer<
  typeof ListMaintenanceWindowsInput
>;

export const GetMaintenanceWindowInput = z.object({ id: z.number().int() });
export type GetMaintenanceWindowInput = z.infer<
  typeof GetMaintenanceWindowInput
>;

export const CreateMaintenanceWindowInput = z
  .object({
    title: z.string().trim().min(1).max(256),
    mode: z.enum(monitorMaintenanceWindowModes).default("pause"),
    from: coercedDate,
    to: coercedDate,
    monitorIds,
  })
  .refine((v) => v.from < v.to, {
    path: ["to"],
    error: "End date must be after start date.",
  });
export type CreateMaintenanceWindowInput = z.input<
  typeof CreateMaintenanceWindowInput
>;

export const UpdateMaintenanceWindowInput = z.object({
  id: z.number().int(),
  title: z.string().trim().min(1).max(256).optional(),
  mode: z.enum(monitorMaintenanceWindowModes).optional(),
  from: coercedDate.optional(),
  to: coercedDate.optional(),
  /** Replaces the full monitor set. */
  monitorIds: monitorIds.optional(),
});
export type UpdateMaintenanceWindowInput = z.infer<
  typeof UpdateMaintenanceWindowInput
>;

export const EndMaintenanceWindowInput = z.object({ id: z.number().int() });
export type EndMaintenanceWindowInput = z.infer<
  typeof EndMaintenanceWindowInput
>;

export const DeleteMaintenanceWindowInput = z.object({ id: z.number().int() });
export type DeleteMaintenanceWindowInput = z.infer<
  typeof DeleteMaintenanceWindowInput
>;
