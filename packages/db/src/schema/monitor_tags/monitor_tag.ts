import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";
import { workspace } from "../workspaces";

export const monitorTag = sqliteTable("monitor_tag", {
  id: integer("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspace.id, { onDelete: "cascade" })
    .notNull(),

  name: text("name").notNull(),
  color: text("color").notNull(),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const monitorTagsToMonitors = sqliteTable(
  "monitor_tag_to_monitor",
  {
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    monitorTagId: integer("monitor_tag_id")
      .notNull()
      .references(() => monitorTag.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.monitorId, t.monitorTagId] }),
  }),
);

export const monitorTagsToMonitorsRelation = relations(
  monitorTagsToMonitors,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [monitorTagsToMonitors.monitorId],
      references: [monitor.id],
    }),
    monitorTag: one(monitorTag, {
      fields: [monitorTagsToMonitors.monitorTagId],
      references: [monitorTag.id],
    }),
  }),
);

export const monitorTagRelations = relations(monitorTag, ({ one, many }) => ({
  monitor: many(monitorTagsToMonitors),
  workspace: one(workspace, {
    fields: [monitorTag.workspaceId],
    references: [workspace.id],
  }),
}));
