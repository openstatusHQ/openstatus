import { sql } from "drizzle-orm";
import { index, integer, sqliteTable } from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";
import { workspace } from "../workspaces/workspace";

export const monitorRun = sqliteTable(
  "monitor_run",
  {
    id: integer("id").primaryKey(),

    workspaceId: integer("workspace_id").references(() => workspace.id),
    monitorId: integer("monitor_id").references(() => monitor.id),

    runnedAt: integer("runned_at", { mode: "timestamp_ms" }),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    // Composite, not workspace_id alone: the monthly quota count(*) filters on
    // both, and monitor_run is append-only so the scan only ever grows.
    index("monitor_run_workspace_id_created_at_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
    index("monitor_run_monitor_id_idx").on(t.monitorId),
  ],
);
