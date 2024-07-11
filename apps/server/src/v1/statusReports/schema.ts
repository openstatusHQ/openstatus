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

export const StatusReportSchema = z.object({
  id: z.number().openapi({ description: "The id of the status report" }),
  title: z.string().openapi({
    example: "Documenso",
    description: "The title of the status report",
  }),
  status: statusReportStatusSchema.openapi({
    description: "The current status of the report",
  }),
  // REMINDER: extended only on POST requests
  // date: isoDate.openapi({
  //   description: "The date of the report in ISO8601 format",
  // }),
  // message: z.string().openapi({
  //   description: "The message of the current status of incident",
  // }),
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
    .nullable()
    .default([])
    .openapi({
      description: "id of monitors this report needs to refer",
    })
    .nullable(),
});

export type StatusReportSchema = z.infer<typeof StatusReportSchema>;
