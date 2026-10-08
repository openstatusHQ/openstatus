import { z } from "@hono/zod-openapi";

export const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^\d+$/, "ID must be a numeric string")
    .openapi({
      param: { name: "id", in: "path" },
      description: "The maintenance update id",
      example: "1",
    }),
});

export const MaintenanceUpdateSchema = z
  .object({
    id: z.coerce.string().openapi({ description: "The update id" }),
    message: z.string().min(1).openapi({ description: "The public message" }),
    date: z.coerce.date().openapi({ description: "The update date" }),
    maintenanceId: z.number().int().openapi({
      description: "The maintenance id",
    }),
    createdAt: z.coerce.date().nullable(),
    updatedAt: z.coerce.date().nullable(),
  })
  .openapi("MaintenanceUpdate");

// JSON `null` would coerce to 1970-01-01 with a bare `z.coerce.date()`.
const isoDate = z.iso.datetime({ offset: true }).pipe(z.coerce.date());

export const CreateMaintenanceUpdateSchema = z.object({
  maintenanceId: z.number().int(),
  message: z.string().min(1),
  date: isoDate.optional().openapi({
    description: "ISO 8601 date-time of the update; defaults to now",
  }),
  notify: z.boolean().default(false),
});

export const UpdateMaintenanceUpdateSchema = z
  .object({
    message: z.string().min(1).optional(),
    date: isoDate.optional().openapi({
      description: "ISO 8601 date-time of the update",
    }),
  })
  .refine((input) => input.message !== undefined || input.date !== undefined, {
    message: "At least one field must be provided.",
  });

export const DeleteMaintenanceUpdateResponseSchema = z.object({
  success: z.boolean(),
});
