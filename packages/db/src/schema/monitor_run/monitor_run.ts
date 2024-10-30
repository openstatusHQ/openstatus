import { sql } from "drizzle-orm";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { monitor } from "../monitors";
import { workspace } from "../workspaces/workspace";

export const monitorRun = sqliteTable("monitor_run", {
  id: integer("id").primaryKey(),

  workspaceId: integer("workspace_id").references(() => workspace.id),
  monitorId: integer("monitor_id").references(() => monitor.id),

  runnedAt: integer("runned_at", { mode: "timestamp_ms" }),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});
