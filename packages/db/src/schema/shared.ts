import { z } from "zod";

import { selectMonitorSchema } from "./monitors";
import { selectPageSchema } from "./pages";
import {
  selectStatusReportSchema,
  selectStatusReportUpdateSchema,
} from "./status_reports";
import { workspacePlanSchema } from "./workspaces";

// TODO: create a 'public-status' schema with all the different types and validations

export const selectPublicMonitorSchema = selectMonitorSchema.omit({
  body: true,
  headers: true,
  regions: true,
  method: true,
});

export const selectStatusReportPageSchema = z.array(
  selectStatusReportSchema.extend({
    statusReportUpdates: z.array(selectStatusReportUpdateSchema).default([]),
    monitorsToStatusReports: z
      .array(
        z.object({
          monitorId: z.number(),
          statusReportId: z.number(),
          monitor: selectPublicMonitorSchema,
        }),
      )
      .default([]),
  }),
);
export const selectPageSchemaWithRelation = selectPageSchema.extend({
  monitors: z.array(selectMonitorSchema),
  statusReports: selectStatusReportPageSchema,
});

export const selectPublicPageSchemaWithRelation = selectPageSchema
  .extend({
    monitors: z.array(selectPublicMonitorSchema),
    statusReports: selectStatusReportPageSchema,
    workspacePlan: workspacePlanSchema
      .nullable()
      .default("free")
      .transform((val) => val ?? "free"),
  })
  .omit({
    workspaceId: true,
    id: true,
  });

export const selectPublicStatusReportSchemaWithRelation =
  selectStatusReportSchema.extend({
    monitorsToStatusReports: z
      .array(z.object({ monitor: selectPublicMonitorSchema }))
      .default([]),
    statusReportUpdates: z.array(selectStatusReportUpdateSchema),
  });
