import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { monitor } from "./monitor";
import { workspace } from "./workspace";

const name = ["email", "discord", "slack"] as const;

export const notification = sqliteTable("notification", {
  id: integer("id").primaryKey(),
  name: text("name", { enum: name }).notNull(),
  data: text("data", { mode: "json" }).notNull().default("{}"),
  workspaceId: integer("workspace_id").references(() => workspace.id),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

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

export const notificationRelations = relations(
  notification,
  ({ one, many }) => ({
    workspace: one(workspace, {
      fields: [notification.workspaceId],
      references: [workspace.id],
    }),
    monitor: many(notification),
  }),
);
