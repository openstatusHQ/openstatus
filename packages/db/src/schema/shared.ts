import { z } from "zod";

import { selectIncidentSchema } from "./incidents/validation";
import { selectMaintenanceSchema } from "./maintenances";
import { selectMonitorSchema } from "./monitors";
import { selectPageSchema } from "./pages";
import {
  selectStatusReportSchema,
  selectStatusReportUpdateSchema,
} from "./status_reports";
import { workspacePlanSchema } from "./workspaces";

// TODO: create a 'public-status' schema with all the different types and validations

export const flyRegions = [
  "ams",
  "arn",
  "atl",
  "bog",
  "bom",
  "bos",
  "cdg",
  "den",
  "dfw",
  "ewr",
  "eze",
  "fra",
  "gdl",
  "gig",
  "gru",
  "hkg",
  "iad",
  "jnb",
  "lax",
  "lhr",
  "mad",
  "mia",
  "nrt",
  "ord",
  "otp",
  "phx",
  "qro",
  "scl",
  "sjc",
  "sea",
  "sin",
  "syd",
  "waw",
  "yul",
  "yyz",
] as const;

export const monitorPeriodicity = [
  "30s",
  "1m",
  "5m",
  "10m",
  "30m",
  "1h",
  "other",
] as const;

export const monitorRegions = [...flyRegions] as const;
export const monitorPeriodicitySchema = z.enum(monitorPeriodicity);
export const monitorRegionSchema = z.enum(monitorRegions);
export const monitorFlyRegionSchema = z.enum(flyRegions);
export type MonitorFlyRegion = z.infer<typeof monitorFlyRegionSchema>;

export const selectPublicMonitorSchema = selectMonitorSchema.omit({
  body: true,
  headers: true,
  method: true,
});

export const selectStatusReportPageSchema = selectStatusReportSchema.extend({
  statusReportUpdates: z.array(selectStatusReportUpdateSchema).default([]),
  monitorsToStatusReports: z
    .array(
      z.object({
        monitorId: z.number(),
        statusReportId: z.number(),
        monitor: selectPublicMonitorSchema,
      })
    )
    .default([]),
});

export const selectMaintenancePageSchema = selectMaintenanceSchema.extend({
  maintenancesToMonitors: z
    .array(
      z.object({
        monitorId: z.number(),
        maintenanceId: z.number(),
      })
    )
    .default([]),
});
// TODO: it would be nice to automatically add the monitor relation here
// .refine((data) => ({ monitors: data.maintenancesToMonitors.map((m) => m.monitorId) }));

export const selectPageSchemaWithRelation = selectPageSchema.extend({
  monitors: z.array(selectMonitorSchema),
  statusReports: z.array(selectStatusReportPageSchema),
});

export const selectPageSchemaWithMonitorsRelation = selectPageSchema.extend({
  monitorsToPages: z.array(
    z.object({
      monitorId: z.number(),
      pageId: z.number(),
      order: z.number().default(0).optional(),
      monitor: selectMonitorSchema,
    })
  ),
  maintenancesToPages: selectMaintenanceSchema.array().default([]),
});

export const selectPublicPageSchemaWithRelation = selectPageSchema
  .extend({
    monitors: z.array(selectPublicMonitorSchema),
    statusReports: z.array(selectStatusReportPageSchema),
    incidents: z.array(selectIncidentSchema),
    maintenances: z.array(selectMaintenancePageSchema),
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
      .array(
        z.object({
          monitorId: z.number(),
          statusReportId: z.number(),
          monitor: selectPublicMonitorSchema,
        })
      )
      .default([]),
    statusReportUpdates: z.array(selectStatusReportUpdateSchema),
  });

export type StatusReportWithUpdates = z.infer<
  typeof selectStatusReportPageSchema
>;
export type PublicMonitor = z.infer<typeof selectPublicMonitorSchema>;
export type PublicPage = z.infer<typeof selectPublicPageSchemaWithRelation>;
