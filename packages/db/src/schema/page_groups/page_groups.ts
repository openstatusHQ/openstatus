import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { pageComponent } from "../page_components";
import { page } from "../pages";
import { workspace } from "../workspaces";

export const pageGroup = sqliteTable("page_groups", {
  id: integer("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspace.id, { onDelete: "cascade" })
    .notNull(),
  pageId: integer("page_id")
    .references(() => page.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const pageGroupRelations = relations(pageGroup, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [pageGroup.workspaceId],
    references: [workspace.id],
  }),
  page: one(page, {
    fields: [pageGroup.pageId],
    references: [page.id],
  }),
  pageComponents: many(pageComponent),
}));
