import { z } from "@hono/zod-openapi";

export const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the maintenance",
      example: "1",
    }),
});

export const MaintenanceSchema = z
  .object({
    id: z.number().openapi({
      description: "The id of the maintenance",
      example: 1,
    }),
    title: z.string().openapi({
      description: "The title of the maintenance",
      example: "Database Upgrade",
    }),
    message: z.string().openapi({
      description: "The message describing the maintenance",
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
      .optional()
      .default([])
      .openapi({ description: "IDs of affected monitors" }),
    pageId: z.number().openapi({
      description: "The id of the status page this maintenance belongs to",
    }),
  })
  .openapi("Maintenance");

export type MaintenanceSchema = z.infer<typeof MaintenanceSchema>;
