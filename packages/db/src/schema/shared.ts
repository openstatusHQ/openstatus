import { z } from "zod";

import { selectIncidentSchema } from "./incidents/validation";
import { selectMaintenanceSchema } from "./maintenances";
import { selectMonitorGroupSchema } from "./monitor_groups";
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
  method: true,
  otelEndpoint: true,
  otelHeaders: true,
});

export const selectStatusReportPageSchema = selectStatusReportSchema.extend({
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
});

export const selectMaintenancePageSchema = selectMaintenanceSchema.extend({
  maintenancesToMonitors: z
    .array(
      z.object({
        monitorId: z.number(),
        maintenanceId: z.number(),
        monitor: selectPublicMonitorSchema,
      }),
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
    }),
  ),
  maintenances: selectMaintenanceSchema.array().default([]),
  statusReports: selectStatusReportSchema
    .extend({ statusReportUpdates: selectStatusReportUpdateSchema.array() })
    .array()
    .default([]),
});

export const legacy_selectPublicPageSchemaWithRelation = selectPageSchema
  .extend({
    monitors: z.array(selectPublicMonitorSchema).default([]),
    statusReports: z.array(selectStatusReportPageSchema).default([]),
    incidents: z.array(selectIncidentSchema).default([]),
    maintenances: z.array(selectMaintenancePageSchema).default([]),
    workspacePlan: workspacePlanSchema
      .nullable()
      .default("free")
      .transform((val) => val ?? "free"),
  })
  .omit({
    // workspaceId: true,
    id: true,
  });

const selectPublicMonitorWithStatusSchema = selectPublicMonitorSchema.extend({
  status: z.enum(["success", "degraded", "error", "info"]).default("success"),
  monitorGroupId: z.number().nullable().optional(),
  order: z.number().default(0).optional(),
  groupOrder: z.number().default(0).optional(),
});

const trackersSchema = z
  .array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("monitor"),
        monitor: selectPublicMonitorWithStatusSchema,
        order: z.number(),
      }),
      z.object({
        type: z.literal("group"),
        groupId: z.number(),
        groupName: z.string(),
        monitors: z.array(selectPublicMonitorWithStatusSchema),
        status: z
          .enum(["success", "degraded", "error", "info"])
          .default("success"),
        order: z.number(),
      }),
    ]),
  )
  .default([]);

export const selectPublicPageSchemaWithRelation = selectPageSchema
  .extend({
    monitorGroups: selectMonitorGroupSchema.array().default([]),
    // TODO: include status of the monitor
    monitors: selectPublicMonitorWithStatusSchema.array(),
    trackers: trackersSchema,
    lastEvents: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        from: z.date(),
        to: z.date().nullable(),
        status: z
          .enum(["success", "degraded", "error", "info"])
          .default("success"),
        type: z.enum(["maintenance", "incident", "report"]),
      }),
    ),
    openEvents: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        from: z.date(),
        to: z.date().nullable(),
        status: z
          .enum(["success", "degraded", "error", "info"])
          .default("success"),
        type: z.enum(["maintenance", "incident", "report"]),
      }),
    ),
    statusReports: z.array(selectStatusReportPageSchema),
    incidents: z.array(selectIncidentSchema),
    maintenances: z.array(selectMaintenancePageSchema),
    status: z.enum(["success", "degraded", "error", "info"]).default("success"),
    workspacePlan: workspacePlanSchema
      .nullable()
      .default("free")
      .transform((val) => val ?? "free"),
  })
  .omit({
    // workspaceId: true,
    // id: true,
    password: true,
  });

export const selectPublicStatusReportSchemaWithRelation =
  selectStatusReportSchema.extend({
    monitorsToStatusReports: z
      .array(
        z.object({
          monitorId: z.number(),
          statusReportId: z.number(),
          monitor: selectPublicMonitorSchema,
        }),
      )
      .default([]),
    statusReportUpdates: z.array(selectStatusReportUpdateSchema),
  });

export type StatusReportWithUpdates = z.infer<
  typeof selectStatusReportPageSchema
>;
export type PublicMonitor = z.infer<typeof selectPublicMonitorSchema>;
export type PublicPage = z.infer<
  typeof legacy_selectPublicPageSchemaWithRelation
>;
