import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors/monitor";
import { user } from "../users";
import { workspace } from "../workspaces/workspace";
import { monitorMaintenanceWindowModes } from "./constants";

/** [from, to) in which the window's monitors pause, or keep checking without status changes or alerts. */
export const monitorMaintenanceWindow = sqliteTable(
  "monitor_maintenance_window",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    title: text("title", { length: 256 }).notNull(),
    mode: text("mode", { enum: monitorMaintenanceWindowModes })
      .notNull()
      .default("pause"),
    from: integer("from", { mode: "timestamp" }).notNull(),
    to: integer("to", { mode: "timestamp" }).notNull(),

    createdBy: integer("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedBy: integer("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    index("monitor_maintenance_window_workspace_id_idx").on(t.workspaceId),
    // the checker cron asks "active now" every tick; nearly all rows have ended
    index("monitor_maintenance_window_to_idx").on(t.to),
  ],
);

export const monitorMaintenanceWindowToMonitor = sqliteTable(
  "monitor_maintenance_window_to_monitor",
  {
    monitorMaintenanceWindowId: integer("monitor_maintenance_window_id")
      .notNull()
      .references(() => monitorMaintenanceWindow.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.monitorMaintenanceWindowId, t.monitorId] }),
    index("monitor_maintenance_window_to_monitor_monitor_id_idx").on(
      t.monitorId,
    ),
  ],
);
