import { z } from "@hono/zod-openapi";

import { statusReportStatusSchema } from "@openstatus/db/src/schema";

export const ParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      description: "The id of the status report",
      example: "1",
    }),
});

export const StatusReportSchema = z
  .object({
    id: z.number().openapi({ description: "The id of the status report" }),
    title: z.string().openapi({
      example: "Documenso",
      description: "The title of the status report",
    }),
    status: statusReportStatusSchema.openapi({
      description: "The current status of the report",
    }),
    statusReportUpdateIds: z
      .array(z.number())
      .optional()
      .nullable()
      .default([])
      .openapi({
        description: "The ids of the status report updates",
      }),
    monitorIds: z
      .array(z.number())
      .optional()
      .default([])
      .openapi({ description: "Ids of the monitors the status report." }),
    pageId: z.number().openapi({
      description: "The id of the page this status report belongs to",
    }),
  })
  .openapi("StatusReport");

export type StatusReportSchema = z.infer<typeof StatusReportSchema>;
