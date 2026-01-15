import { relations, sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";
import { pageGroup } from "../page_groups";
import { page } from "../pages";
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
    type: text("type", { enum: pageComponentTypes })
      .notNull()
      .default("monitor"),
    monitorId: integer("monitor_id").references(() => monitor.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    description: text("description"),
    order: integer("order").default(0),
    groupId: integer("group_id").references(() => pageGroup.id, {
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
  (t) => ({
    uniquePageMonitor: unique().on(t.pageId, t.monitorId),
  }),
);

export const pageComponentRelations = relations(pageComponent, ({ one }) => ({
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
  group: one(pageGroup, {
    fields: [pageComponent.groupId],
    references: [pageGroup.id],
  }),
}));
