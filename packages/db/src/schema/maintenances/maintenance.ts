import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { page } from "../pages";
import { workspace } from "../workspaces";
import { monitor } from "../monitors";

export const maintenance = sqliteTable("maintenance", {
  id: integer("id").primaryKey(),
  title: text("title", { length: 256 }).notNull(),
  message: text("message").notNull(),

  from: integer("from", { mode: "timestamp" }).notNull(),
  to: integer("to", { mode: "timestamp" }).notNull(),

  workspaceId: integer("workspace_id").references(() => workspace.id),
  pageId: integer("page_id").references(() => page.id),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`
  ),
});

export const maintenancesToMonitors = sqliteTable(
  "maintenance_to_monitor",
  {
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    maintenanceId: integer("maintenance_id")
      .notNull()
      .references(() => maintenance.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`
    ),
  },
  (t) => ({
    pk: primaryKey(t.monitorId, t.maintenanceId),
  })
);

export const maintenancesToMonitorsRelations = relations(
  maintenancesToMonitors,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [maintenancesToMonitors.monitorId],
      references: [monitor.id],
    }),
    maintenance: one(maintenance, {
      fields: [maintenancesToMonitors.maintenanceId],
      references: [maintenance.id],
    }),
  })
);

export const maintenanceRelations = relations(maintenance, ({ one, many }) => ({
  maintenancesToMonitors: many(maintenancesToMonitors),
  workspace: one(workspace, {
    fields: [maintenance.workspaceId],
    references: [workspace.id],
  }),
}));
