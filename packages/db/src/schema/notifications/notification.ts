import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";
import { workspace } from "../workspaces";
import { notificationProvider } from "./constants";

export const notification = sqliteTable("notification", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider", { enum: notificationProvider }).notNull(),
  data: text("data").default("{}"),
  workspaceId: integer("workspace_id").references(() => workspace.id),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const notificationTrigger = sqliteTable(
  "notification_trigger",
  {
    id: integer("id").primaryKey(),
    monitorId: integer("monitor_id").references(() => monitor.id, {
      onDelete: "cascade",
    }),
    notificationId: integer("notification_id").references(
      () => notification.id,
      { onDelete: "cascade" },
    ),
    cronTimestamp: integer("cron_timestamp").notNull(),
  },
  (table) => ({
    unique: uniqueIndex("notification_id_monitor_id_crontimestampe").on(
      table.notificationId,
      table.monitorId,
      table.cronTimestamp,
    ),
  }),
);

export const notificationsToMonitors = sqliteTable(
  "notifications_to_monitors",
  {
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    notificationId: integer("notification_id")
      .notNull()
      .references(() => notification.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.monitorId, t.notificationId] }),
  }),
);

export const notificationsToMonitorsRelation = relations(
  notificationsToMonitors,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [notificationsToMonitors.monitorId],
      references: [monitor.id],
    }),
    notification: one(notification, {
      fields: [notificationsToMonitors.notificationId],
      references: [notification.id],
    }),
  }),
);

export const notificationRelations = relations(
  notification,
  ({ one, many }) => ({
    workspace: one(workspace, {
      fields: [notification.workspaceId],
      references: [workspace.id],
    }),
    monitor: many(notificationsToMonitors),
  }),
);
