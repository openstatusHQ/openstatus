import { z } from "@hono/zod-openapi";

export const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^\d+$/, "ID must be a numeric string")
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the maintenance",
      example: "1",
    }),
});

export const MaintenanceObjectSchema = z.object({
  id: z.number().openapi({
    description: "The id of the maintenance",
    example: 1,
  }),
  title: z.string().openapi({
    description: "The title of the maintenance",
    example: "Database Upgrade",
  }),
  message: z.string().min(1).openapi({
    description:
      "The newest timeline update. On create it becomes the first update; on update it rewrites the newest one.",
    example: "Upgrading database to improve performance",
  }),
  from: z.coerce.date().openapi({
    description: "When the maintenance starts",
  }),
  to: z.coerce.date().openapi({
    description: "When the maintenance ends",
  }),
  monitorIds: z
    .array(z.number())

    .prefault([])
    .openapi({ description: "IDs of affected monitors" }),
  pageId: z.number().openapi({
    description: "The id of the status page this maintenance belongs to",
  }),
});

export const refineDateRange = <T extends { from?: Date; to?: Date }>(v: T) =>
  !v.from || !v.to || v.from <= v.to;
export const dateRangeError = {
  error: "'from' date must be before 'to' date",
} as const;

export const MaintenanceSchema = MaintenanceObjectSchema.refine(
  refineDateRange,
  dateRangeError,
).openapi("Maintenance");

export type MaintenanceSchema = z.infer<typeof MaintenanceSchema>;
