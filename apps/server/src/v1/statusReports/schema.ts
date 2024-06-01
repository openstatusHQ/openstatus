import { z } from "@hono/zod-openapi";

import { statusReportStatusSchema } from "@openstatus/db/src/schema";

import { isoDate } from "../utils";

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

export const StatusReportUpdateSchema = z.object({
  status: statusReportStatusSchema.openapi({
    description: "The status of the update",
  }),
  date: isoDate.openapi({
    description: "The date of the update in ISO8601 format",
  }),
  message: z.string().openapi({
    description: "The message of the update",
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
  status_report_updates: z
    .array(z.number())
    .openapi({
      description: "The ids of the status report updates",
    })
    .default([]),
});

export type StatusReportSchema = z.infer<typeof StatusReportSchema>;
export type StatusReportUpdateSchema = z.infer<typeof StatusReportUpdateSchema>;
