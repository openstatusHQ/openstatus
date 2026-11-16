import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { monitorMaintenanceWindow } from "../monitor_maintenance_windows/monitor_maintenance_window";
import { monitor } from "../monitors/monitor";
import { user } from "../users";
import { workspace } from "../workspaces/workspace";
import { uptimeTargetExcusedWindowKinds } from "./constants";
import { uptimeTarget } from "./uptime_target";

/** [from, to) whose runs count for none of its monitors. */
export const uptimeTargetExcusedWindow = sqliteTable(
  "uptime_target_excused_window",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    uptimeTargetId: integer("uptime_target_id")
      .notNull()
      .references(() => uptimeTarget.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: uptimeTargetExcusedWindowKinds }).notNull(),
    reason: text("reason").notNull(),
    from: integer("from", { mode: "timestamp" }).notNull(),
    to: integer("to", { mode: "timestamp" }).notNull(),
    // provenance only: the excused window keeps its own from/to
    monitorMaintenanceWindowId: integer(
      "monitor_maintenance_window_id",
    ).references(() => monitorMaintenanceWindow.id, { onDelete: "set null" }),
    createdBy: integer("created_by").references(() => user.id, {
      onDelete: "set null",
    }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    index("uptime_target_excused_window_target_id_idx").on(t.uptimeTargetId),
  ],
);

/** The policy members a window excuses, fixed when it is added. */
export const uptimeTargetExcusedWindowToMonitor = sqliteTable(
  "uptime_target_excused_window_to_monitor",
  {
    uptimeTargetExcusedWindowId: integer("uptime_target_excused_window_id")
      .notNull()
      .references(() => uptimeTargetExcusedWindow.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.uptimeTargetExcusedWindowId, t.monitorId] }),
    index("uptime_target_excused_window_to_monitor_monitor_id_idx").on(
      t.monitorId,
    ),
  ],
);

export const uptimeTargetExcusedWindowRelations = relations(
  uptimeTargetExcusedWindow,
  ({ one, many }) => ({
    monitors: many(uptimeTargetExcusedWindowToMonitor),
    policy: one(uptimeTarget, {
      fields: [uptimeTargetExcusedWindow.uptimeTargetId],
      references: [uptimeTarget.id],
    }),
    createdByUser: one(user, {
      fields: [uptimeTargetExcusedWindow.createdBy],
      references: [user.id],
    }),
  }),
);

export const uptimeTargetExcusedWindowToMonitorRelations = relations(
  uptimeTargetExcusedWindowToMonitor,
  ({ one }) => ({
    window: one(uptimeTargetExcusedWindow, {
      fields: [uptimeTargetExcusedWindowToMonitor.uptimeTargetExcusedWindowId],
      references: [uptimeTargetExcusedWindow.id],
    }),
    monitor: one(monitor, {
      fields: [uptimeTargetExcusedWindowToMonitor.monitorId],
      references: [monitor.id],
    }),
  }),
);
