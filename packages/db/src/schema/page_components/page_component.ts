import { relations, sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { maintenance } from "../maintenances";
import { monitorGroup } from "../monitor_groups";
import { monitor } from "../monitors";
import { page } from "../pages";
import { statusReport } from "../status_reports";
import { workspace } from "../workspaces";

export const pageComponentTypes = ["external", "monitor"] as const;

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

    // Component type: 'external' for manual status, 'monitor' for monitor-linked
    type: text("type", { enum: pageComponentTypes }).notNull(),

    // Monitor link (nullable, required if type = 'monitor')
    monitorId: integer("monitor_id").references(() => monitor.id, {
      onDelete: "cascade",
    }),

    // Display properties
    name: text("name", { length: 256 }).notNull(),
    description: text("description"),

    // Ordering (preserved from monitors_to_pages pattern)
    order: integer("order").default(0),

    // Group assignment (optional)
    monitorGroupId: integer("monitor_group_id").references(
      () => monitorGroup.id,
      { onDelete: "cascade" },
    ),
    groupOrder: integer("group_order").default(0),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => ({
    // Constraint: monitorId must be defined when type = 'monitor'
    monitorRequiredForMonitorType: check(
      "monitor_required_for_monitor_type",
      sql`${t.type} != 'monitor' OR ${t.monitorId} IS NOT NULL`,
    ),
  }),
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
    monitorGroup: one(monitorGroup, {
      fields: [pageComponent.monitorGroupId],
      references: [monitorGroup.id],
    }),
    statusReportsToPageComponents: many(statusReportsToPageComponents),
    maintenancesToPageComponents: many(maintenancesToPageComponents),
  }),
);

// Junction table: status_reports to page_components
export const statusReportsToPageComponents = sqliteTable(
  "status_reports_to_page_components",
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
  (t) => ({
    pk: primaryKey({ columns: [t.statusReportId, t.pageComponentId] }),
  }),
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

// Junction table: maintenances to page_components
export const maintenancesToPageComponents = sqliteTable(
  "maintenances_to_page_components",
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
  (t) => ({
    pk: primaryKey({ columns: [t.maintenanceId, t.pageComponentId] }),
  }),
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
