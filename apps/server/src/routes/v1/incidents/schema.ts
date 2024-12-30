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
      description: "The id of the Incident",
      example: "1",
    }),
});

export const IncidentSchema = z.object({
  id: z.number().openapi({
    description: "The id of the incident",
    example: 1,
  }),
  startedAt: z.coerce.date().openapi({
    description: "The date the incident started",
  }),
  monitorId: z
    .number()
    .openapi({
      description: "The id of the monitor associated with the incident",
      example: 1,
    })
    .nullable(),
  acknowledgedAt: z.coerce
    .date()
    .openapi({
      description: "The date the incident was acknowledged",
    })
    .optional()
    .nullable(),
  acknowledgedBy: z
    .number()
    .openapi({
      description: "The user who acknowledged the incident",
    })
    .nullable(),
  resolvedAt: z.coerce
    .date()
    .openapi({
      description: "The date the incident was resolved",
    })
    .optional()
    .nullable(),
  resolvedBy: z
    .number()
    .openapi({
      description: "The user who resolved the incident",
    })
    .nullable(),
});

export type IncidentSchema = z.infer<typeof IncidentSchema>;
