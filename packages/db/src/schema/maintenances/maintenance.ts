import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { monitorMaintenanceWindow } from "../monitor_maintenance_windows/monitor_maintenance_window";
import { maintenancesToPageComponents } from "../page_components";
import { page } from "../pages";
import { user } from "../users";
import { workspace } from "../workspaces";

export const maintenance = sqliteTable(
  "maintenance",
  {
    id: integer("id").primaryKey(),
    title: text("title", { length: 256 }).notNull(),
    // deprecated: mirror of the first `maintenance_update` (backfilled in
    // migration 0092); dropped in a follow-up
    message: text("message").notNull(),

    from: integer("from", { mode: "timestamp" }).notNull(),
    to: integer("to", { mode: "timestamp" }).notNull(),
    // internal: set when announced from a window, whose times and checks it follows
    monitorMaintenanceWindowId: integer(
      "monitor_maintenance_window_id",
    ).references(() => monitorMaintenanceWindow.id, { onDelete: "set null" }),

    workspaceId: integer("workspace_id").references(() => workspace.id),
    pageId: integer("page_id").references(() => page.id, {
      onDelete: "cascade",
    }),

    createdBy: integer("created_by").references(() => user.id),
    updatedBy: integer("updated_by").references(() => user.id),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    index("maintenance_page_id_idx").on(t.pageId),
    index("maintenance_workspace_id_idx").on(t.workspaceId),
    index("maintenance_monitor_maintenance_window_id_idx").on(
      t.monitorMaintenanceWindowId,
    ),
  ],
);

export const maintenanceUpdate = sqliteTable(
  "maintenance_update",
  {
    id: integer("id").primaryKey(),
    message: text("message").notNull(),
    date: integer("date", { mode: "timestamp" }).notNull(),
    maintenanceId: integer("maintenance_id")
      .references(() => maintenance.id, { onDelete: "cascade" })
      .notNull(),

    createdBy: integer("created_by").references(() => user.id),
    updatedBy: integer("updated_by").references(() => user.id),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [index("maintenance_update_maintenance_id_idx").on(t.maintenanceId)],
);

export const maintenanceRelations = relations(maintenance, ({ one, many }) => ({
  maintenancesToPageComponents: many(maintenancesToPageComponents),
  maintenanceUpdates: many(maintenanceUpdate),
  page: one(page, {
    fields: [maintenance.pageId],
    references: [page.id],
  }),
  window: one(monitorMaintenanceWindow, {
    fields: [maintenance.monitorMaintenanceWindowId],
    references: [monitorMaintenanceWindow.id],
  }),
  workspace: one(workspace, {
    fields: [maintenance.workspaceId],
    references: [workspace.id],
  }),
  createdByUser: one(user, {
    fields: [maintenance.createdBy],
    references: [user.id],
    relationName: "maintenanceCreatedBy",
  }),
  updatedByUser: one(user, {
    fields: [maintenance.updatedBy],
    references: [user.id],
    relationName: "maintenanceUpdatedBy",
  }),
}));

export const maintenanceUpdateRelations = relations(
  maintenanceUpdate,
  ({ one }) => ({
    maintenance: one(maintenance, {
      fields: [maintenanceUpdate.maintenanceId],
      references: [maintenance.id],
    }),
    createdByUser: one(user, {
      fields: [maintenanceUpdate.createdBy],
      references: [user.id],
      relationName: "maintenanceUpdateCreatedBy",
    }),
    updatedByUser: one(user, {
      fields: [maintenanceUpdate.updatedBy],
      references: [user.id],
      relationName: "maintenanceUpdateUpdatedBy",
    }),
  }),
);
