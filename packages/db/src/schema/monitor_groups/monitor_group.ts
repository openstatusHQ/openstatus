import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { page } from "../pages";
import { workspace } from "../workspaces";

export const monitorGroup = sqliteTable(
  "monitor_group",
  {
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
  },
  (t) => [
    index("monitor_group_workspace_id_idx").on(t.workspaceId),
    index("monitor_group_page_id_idx").on(t.pageId),
  ],
);
