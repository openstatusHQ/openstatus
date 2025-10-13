import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm/sql";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { monitor } from "../monitors/monitor";
import { workspace } from "../workspaces";

export const privateLocation = sqliteTable("private_location", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  key: text("key").notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  workspaceId: integer("workspace_id").references(() => workspace.id),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const privateLocationToMonitors = sqliteTable(
  "private_location_to_monitor",
  {
    privateLocationId: integer("private_location_id").references(
      () => privateLocation.id,
      { onDelete: "cascade" },
    ),
    monitorId: integer("monitor_id").references(() => monitor.id, {
      onDelete: "cascade",
    }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
);

export const privateLocationRelation = relations(
  privateLocation,
  ({ many, one }) => ({
    privateLocationToMonitors: many(privateLocationToMonitors),
    workspace: one(workspace, {
      fields: [privateLocation.workspaceId],
      references: [workspace.id],
    }),
  }),
);

export const privateLocationToMonitorsRelation = relations(
  privateLocationToMonitors,
  ({ one }) => ({
    privateLocation: one(privateLocation, {
      fields: [privateLocationToMonitors.privateLocationId],
      references: [privateLocation.id],
    }),
    monitor: one(monitor, {
      fields: [privateLocationToMonitors.monitorId],
      references: [monitor.id],
    }),
  }),
);
