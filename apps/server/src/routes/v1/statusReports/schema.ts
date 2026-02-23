import { z } from "@hono/zod-openapi";

import { statusReportStatus } from "@openstatus/db/src/schema/status_reports/status_reports";

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
    status: z.enum(statusReportStatus).openapi({
      description: "The current status of the report",
    }),
    statusReportUpdateIds: z
      .array(z.number())
      .optional()
      .nullable()
      .prefault([])
      .openapi({
        description: "The ids of the status report updates",
      }),
    monitorIds: z
      .array(z.number())
      .optional()
      .prefault([])
      .openapi({ description: "Ids of the monitors the status report." }),
    pageId: z.number().openapi({
      description: "The id of the page this status report belongs to",
    }),
  })
  .openapi("StatusReport");

export type StatusReportSchema = z.infer<typeof StatusReportSchema>;
