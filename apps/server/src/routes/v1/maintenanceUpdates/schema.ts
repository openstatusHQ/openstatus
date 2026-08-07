import { z } from "@hono/zod-openapi";

export const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
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

export const CreateMaintenanceUpdateSchema = z.object({
  maintenanceId: z.number().int(),
  message: z.string().min(1),
  date: z.coerce.date().optional(),
  notify: z.boolean().default(false),
});

export const UpdateMaintenanceUpdateSchema = z
  .object({
    message: z.string().min(1).optional(),
    date: z.coerce.date().optional(),
  })
  .refine((input) => input.message !== undefined || input.date !== undefined, {
    message: "At least one field must be provided.",
  });

export const DeleteMaintenanceUpdateResponseSchema = z.object({
  success: z.boolean(),
});
