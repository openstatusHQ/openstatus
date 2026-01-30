import { z } from "zod";

import { selectIncidentSchema } from "./incidents/validation";
import { selectMaintenanceSchema } from "./maintenances";
import { selectMonitorGroupSchema } from "./monitor_groups";
import { selectMonitorSchema } from "./monitors";
import { selectPageComponentGroupSchema } from "./page_component_groups";
import { selectPageComponentSchema } from "./page_components";
import { selectPageSchema } from "./pages";
import {
  selectStatusReportSchema,
  selectStatusReportUpdateSchema,
} from "./status_reports";
import { workspacePlanSchema } from "./workspaces";

// TODO: create a 'public-status' schema with all the different types and validations

// Base schema without transform so it can be extended
const selectPublicMonitorBaseSchema = selectMonitorSchema.omit({
  body: true,
  headers: true,
  method: true,
  otelEndpoint: true,
  otelHeaders: true,
});

export const selectPublicMonitorSchema =
  selectPublicMonitorBaseSchema.transform((data) => ({
    ...data,
    name: data.externalName || data.name,
  }));

export const selectStatusReportPageSchema = selectStatusReportSchema.extend({
  statusReportUpdates: z.array(selectStatusReportUpdateSchema).prefault([]),
  statusReportsToPageComponents: z
    .array(
      z.object({
        pageComponentId: z.number(),
        statusReportId: z.number(),
        pageComponent: selectPageComponentSchema,
      }),
    )
    .prefault([]),
});

export const selectMaintenancePageSchema = selectMaintenanceSchema.extend({
  maintenancesToPageComponents: z
    .array(
      z.object({
        pageComponentId: z.number(),
        maintenanceId: z.number(),
        pageComponent: selectPageComponentSchema,
      }),
    )
    .prefault([]),
});

export const selectPageSchemaWithRelation = selectPageSchema.extend({
  monitors: z.array(selectMonitorSchema),
  statusReports: z.array(selectStatusReportPageSchema),
});

export const legacy_selectPublicPageSchemaWithRelation = selectPageSchema
  .extend({
    monitors: z.array(selectPublicMonitorSchema).prefault([]),
    statusReports: z.array(selectStatusReportPageSchema).prefault([]),
    incidents: z.array(selectIncidentSchema).prefault([]),
    maintenances: z.array(selectMaintenancePageSchema).prefault([]),
    workspacePlan: workspacePlanSchema
      .nullable()
      .prefault("free")
      .transform((val) => val ?? "free"),
  })
  .omit({
    // workspaceId: true,
    id: true,
  });

const selectPublicMonitorWithStatusSchema = selectPublicMonitorBaseSchema
  .extend({
    status: z
      .enum(["success", "degraded", "error", "info"])
      .prefault("success"),
    monitorGroupId: z.number().nullable().optional(),
    order: z.number().default(0).optional(),
    groupOrder: z.number().default(0).nullish(),
  })
  .transform((data) => ({
    ...data,
    name: data.externalName || data.name,
  }));

export const statusPageEventSchema = z.object({
  id: z.number(),
  name: z.string(),
  from: z.date(),
  to: z.date().nullable(),
  status: z.enum(["success", "degraded", "error", "info"]).prefault("success"),
  type: z.enum(["maintenance", "incident", "report"]),
});

// Page component with status - used for new tracker system
const selectPublicPageComponentWithStatusSchema =
  selectPageComponentSchema.extend({
    status: z
      .enum(["success", "degraded", "error", "info"])
      .prefault("success"),
    events: z.array(statusPageEventSchema).prefault([]),
    // For monitor-type components - omit status since it's now at component level
    monitor: selectPublicMonitorBaseSchema
      .extend({
        incidents: selectIncidentSchema.array().nullish(),
      })
      .nullish(),
  });

const trackersSchema = z
  .array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("component"),
        component: selectPublicPageComponentWithStatusSchema,
        order: z.number(),
      }),
      z.object({
        type: z.literal("group"),
        groupId: z.number(),
        groupName: z.string(),
        components: z.array(selectPublicPageComponentWithStatusSchema),
        status: z
          .enum(["success", "degraded", "error", "info"])
          .prefault("success"),
        order: z.number(),
      }),
    ]),
  )
  .prefault([]);

export const selectPageComponentWithMonitorRelation =
  selectPageComponentSchema.extend({
    monitor: selectPublicMonitorBaseSchema
      .extend({
        incidents: selectIncidentSchema.array().nullish(),
      })
      .transform((data) => ({
        ...data,
        name: data.externalName || data.name,
      }))
      .nullish(),
    group: selectPageComponentGroupSchema.nullish(),
  });

export type PageComponentWithMonitorRelation = z.infer<
  typeof selectPageComponentWithMonitorRelation
>;

export const selectPublicPageLightSchemaWithRelation = selectPageSchema
  .extend({
    monitors: z.array(selectPublicMonitorSchema).prefault([]),
    statusReports: z.array(selectStatusReportPageSchema).prefault([]),
    incidents: z.array(selectIncidentSchema).prefault([]),
    maintenances: z.array(selectMaintenancePageSchema).prefault([]),
    workspacePlan: workspacePlanSchema
      .nullable()
      .prefault("free")
      .transform((val) => val ?? "free"),
    // NEW: Include pageComponents for modern consumers
    pageComponents: selectPageComponentWithMonitorRelation.array().prefault([]),
    pageComponentGroups: selectPageComponentGroupSchema.array().prefault([]),
  })
  .omit({
    id: true,
  });

export const selectPublicPageSchemaWithRelation = selectPageSchema.extend({
  monitorGroups: selectMonitorGroupSchema.array().prefault([]),
  // TODO: include status of the monitor
  monitors: selectPublicMonitorWithStatusSchema.array(),
  pageComponents: selectPageComponentWithMonitorRelation.array().prefault([]),
  pageComponentGroups: selectPageComponentGroupSchema.array().prefault([]),
  trackers: trackersSchema,
  lastEvents: z.array(statusPageEventSchema),
  openEvents: z.array(statusPageEventSchema),
  statusReports: z.array(selectStatusReportPageSchema),
  incidents: z.array(selectIncidentSchema),
  maintenances: z.array(selectMaintenancePageSchema),
  status: z.enum(["success", "degraded", "error", "info"]).prefault("success"),
  workspacePlan: workspacePlanSchema
    .nullable()
    .prefault("free")
    .transform((val) => val ?? "free"),
  whiteLabel: z.boolean().prefault(false),
});

export type StatusReportWithUpdates = z.infer<
  typeof selectStatusReportPageSchema
>;
export type PublicMonitor = z.infer<typeof selectPublicMonitorSchema>;
export type PublicPage = z.infer<
  typeof legacy_selectPublicPageSchemaWithRelation
>;
export type PublicPageComponentWithStatus = z.infer<
  typeof selectPublicPageComponentWithStatusSchema
>;
