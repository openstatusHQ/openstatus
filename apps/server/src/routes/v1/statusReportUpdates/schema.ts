import { z } from "@hono/zod-openapi";

import { statusReportStatus } from "@openstatus/db/src/schema";

export const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the update",
      example: "1",
    }),
});

export const StatusReportUpdateSchema = z
  .object({
    id: z.coerce.string().openapi({ description: "The id of the update" }),
    status: z.enum(statusReportStatus).openapi({
      description: "The status of the update",
    }),
    date: z.coerce.date().default(new Date()).openapi({
      description: "The date of the update in ISO8601 format",
    }),
    message: z.string().openapi({
      description: "The message of the update",
    }),
    statusReportId: z.number().openapi({
      description: "The id of the status report",
    }),
  })
  .openapi("StatusReportUpdate");

export type StatusReportUpdateSchema = z.infer<typeof StatusReportUpdateSchema>;
