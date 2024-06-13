import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { workspace } from "../workspaces";

export const application = sqliteTable("application", {
  id: integer("id").primaryKey(),
  name: text("name"), // friendly name for the project
  dsn: text("dsn").unique(), // dsn for the source

  workspaceId: integer("workspace_id").references(() => workspace.id),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});
