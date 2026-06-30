import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import {
  externalService,
  externalServiceComponent,
} from "../external_services";
import { maintenance } from "../maintenances";
import { monitor } from "../monitors";
import { pageComponentGroup } from "../page_component_groups";
import { page } from "../pages";
import { statusReport, statusReportUpdate } from "../status_reports";
import { workspace } from "../workspaces";
import { pageComponentImpact, pageComponentTypes } from "./constants";

export const pageComponent = sqliteTable(
  "page_component",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    pageId: integer("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),
    type: text("type", { enum: pageComponentTypes })
      .notNull()
      .default("monitor"),
    monitorId: integer("monitor_id").references(() => monitor.id, {
      onDelete: "cascade",
    }),
    externalServiceId: integer("external_service_id").references(
      () => externalService.id,
      { onDelete: "cascade" },
    ),
    externalServiceComponentId: integer(
      "external_service_component_id",
    ).references(() => externalServiceComponent.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    order: integer("order").default(0),
    groupId: integer("group_id").references(() => pageComponentGroup.id, {
      onDelete: "set null",
    }),
    groupOrder: integer("group_order").default(0),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    unique("page_component_page_id_monitor_id_unique").on(
      t.pageId,
      t.monitorId,
    ),
    index("page_component_workspace_id_idx").on(t.workspaceId),
    check(
      "page_component_type_check",
      sql`(${t.type} = 'monitor' AND ${t.monitorId} IS NOT NULL AND ${t.externalServiceId} IS NULL AND ${t.externalServiceComponentId} IS NULL) OR (${t.type} = 'static' AND ${t.monitorId} IS NULL AND ${t.externalServiceId} IS NULL AND ${t.externalServiceComponentId} IS NULL) OR (${t.type} = 'external' AND ${t.monitorId} IS NULL AND ${t.externalServiceId} IS NOT NULL)`,
    ),
  ],
);

export const pageComponentRelations = relations(
  pageComponent,
  ({ one, many }) => ({
    workspace: one(workspace, {
      fields: [pageComponent.workspaceId],
      references: [workspace.id],
    }),
    page: one(page, {
      fields: [pageComponent.pageId],
      references: [page.id],
    }),
    monitor: one(monitor, {
      fields: [pageComponent.monitorId],
      references: [monitor.id],
    }),
    externalService: one(externalService, {
      fields: [pageComponent.externalServiceId],
      references: [externalService.id],
    }),
    externalServiceComponent: one(externalServiceComponent, {
      fields: [pageComponent.externalServiceComponentId],
      references: [externalServiceComponent.id],
    }),
    group: one(pageComponentGroup, {
      fields: [pageComponent.groupId],
      references: [pageComponentGroup.id],
    }),
    statusReportsToPageComponents: many(statusReportsToPageComponents),
    statusReportUpdateToPageComponents: many(
      statusReportUpdateToPageComponents,
    ),
    maintenancesToPageComponents: many(maintenancesToPageComponents),
  }),
);

export const maintenancesToPageComponents = sqliteTable(
  "maintenance_to_page_component",
  {
    maintenanceId: integer("maintenance_id")
      .notNull()
      .references(() => maintenance.id, { onDelete: "cascade" }),
    pageComponentId: integer("page_component_id")
      .notNull()
      .references(() => pageComponent.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    primaryKey({ columns: [t.maintenanceId, t.pageComponentId] }),
    index("maintenance_to_page_component_page_component_id_idx").on(
      t.pageComponentId,
    ),
  ],
);

export const maintenancesToPageComponentsRelations = relations(
  maintenancesToPageComponents,
  ({ one }) => ({
    maintenance: one(maintenance, {
      fields: [maintenancesToPageComponents.maintenanceId],
      references: [maintenance.id],
    }),
    pageComponent: one(pageComponent, {
      fields: [maintenancesToPageComponents.pageComponentId],
      references: [pageComponent.id],
    }),
  }),
);

export const statusReportsToPageComponents = sqliteTable(
  "status_report_to_page_component",
  {
    statusReportId: integer("status_report_id")
      .notNull()
      .references(() => statusReport.id, { onDelete: "cascade" }),
    pageComponentId: integer("page_component_id")
      .notNull()
      .references(() => pageComponent.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    primaryKey({ columns: [t.statusReportId, t.pageComponentId] }),
    index("status_report_to_page_component_page_component_id_idx").on(
      t.pageComponentId,
    ),
  ],
);

export const statusReportsToPageComponentsRelations = relations(
  statusReportsToPageComponents,
  ({ one }) => ({
    statusReport: one(statusReport, {
      fields: [statusReportsToPageComponents.statusReportId],
      references: [statusReport.id],
    }),
    pageComponent: one(pageComponent, {
      fields: [statusReportsToPageComponents.pageComponentId],
      references: [pageComponent.id],
    }),
  }),
);

// timeline: the impact each update set per component — the only place impact
// is stored. `status_report_to_page_component` stays the membership source.
export const statusReportUpdateToPageComponents = sqliteTable(
  "status_report_update_to_page_component",
  {
    statusReportUpdateId: integer("status_report_update_id")
      .notNull()
      .references(() => statusReportUpdate.id, { onDelete: "cascade" }),
    pageComponentId: integer("page_component_id")
      .notNull()
      .references(() => pageComponent.id, { onDelete: "cascade" }),
    impact: text("impact", { enum: pageComponentImpact }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    primaryKey({ columns: [t.statusReportUpdateId, t.pageComponentId] }),
    index("status_report_update_to_page_component_page_component_id_idx").on(
      t.pageComponentId,
    ),
  ],
);

export const statusReportUpdateToPageComponentsRelations = relations(
  statusReportUpdateToPageComponents,
  ({ one }) => ({
    statusReportUpdate: one(statusReportUpdate, {
      fields: [statusReportUpdateToPageComponents.statusReportUpdateId],
      references: [statusReportUpdate.id],
    }),
    pageComponent: one(pageComponent, {
      fields: [statusReportUpdateToPageComponents.pageComponentId],
      references: [pageComponent.id],
    }),
  }),
);
