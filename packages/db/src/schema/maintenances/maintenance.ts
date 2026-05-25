import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { maintenancesToPageComponents } from "../page_components";
import { page } from "../pages";
import { workspace } from "../workspaces";

export const maintenance = sqliteTable(
  "maintenance",
  {
    id: integer("id").primaryKey(),
    title: text("title", { length: 256 }).notNull(),
    message: text("message").notNull(),

    from: integer("from", { mode: "timestamp" }).notNull(),
    to: integer("to", { mode: "timestamp" }).notNull(),

    workspaceId: integer("workspace_id").references(() => workspace.id),
    pageId: integer("page_id").references(() => page.id, {
      onDelete: "cascade",
    }),

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
  ],
);

export const maintenanceRelations = relations(maintenance, ({ one, many }) => ({
  maintenancesToPageComponents: many(maintenancesToPageComponents),
  page: one(page, {
    fields: [maintenance.pageId],
    references: [page.id],
  }),
  workspace: one(workspace, {
    fields: [maintenance.workspaceId],
    references: [workspace.id],
  }),
}));
