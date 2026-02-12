import { relations, sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { maintenance } from "../maintenances";
import { monitor } from "../monitors";
import { pageComponentGroup } from "../page_component_groups";
import { pageSubscriptionToPageComponent } from "../page_subscriptions";
import { page } from "../pages";
import { statusReport } from "../status_reports";
import { workspace } from "../workspaces";
import { pageComponentTypes } from "./constants";

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
    check(
      "page_component_type_check",
      //   NOTE: This check ensures that either the component is a monitor or a static component, but not both.
      sql`${t.type} = 'monitor' AND ${t.monitorId} IS NOT NULL OR ${t.type} = 'static' AND ${t.monitorId} IS NULL`,
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
    group: one(pageComponentGroup, {
      fields: [pageComponent.groupId],
      references: [pageComponentGroup.id],
    }),
    statusReportsToPageComponents: many(statusReportsToPageComponents),
    maintenancesToPageComponents: many(maintenancesToPageComponents),
    pageSubscriptions: many(pageSubscriptionToPageComponent),
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
