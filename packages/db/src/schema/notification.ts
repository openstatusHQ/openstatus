import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { monitor } from "./monitor";
import { workspace } from "./workspace";

export const providerName = ["email", "discord", "slack"] as const;

export const notification = sqliteTable("notification", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider", { enum: providerName }).notNull(),
  data: text("data", { mode: "json" }).default("{}"),
  workspaceId: integer("workspace_id").references(() => workspace.id),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const selectNotificationSchema = createSelectSchema(notification);

export const insertNotificationSchema = createInsertSchema(notification);

export const notificationsToMonitors = sqliteTable(
  "notifications_to_monitors",
  {
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id),
    notificationId: integer("notificationId")
      .notNull()
      .references(() => notification.id),
  },
  (t) => ({
    pk: primaryKey(t.monitorId, t.notificationId),
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
