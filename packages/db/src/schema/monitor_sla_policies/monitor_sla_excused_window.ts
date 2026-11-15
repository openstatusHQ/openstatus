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
import { monitorSlaExcusedWindowKinds } from "./constants";
import { monitorSlaPolicy } from "./monitor_sla_policy";

/** [from, to) whose runs count for none of its monitors. */
export const monitorSlaExcusedWindow = sqliteTable(
  "monitor_sla_excused_window",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    monitorSlaPolicyId: integer("monitor_sla_policy_id")
      .notNull()
      .references(() => monitorSlaPolicy.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: monitorSlaExcusedWindowKinds }).notNull(),
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
    index("monitor_sla_excused_window_policy_id_idx").on(t.monitorSlaPolicyId),
  ],
);

/** The policy members a window excuses, fixed when it is added. */
export const monitorSlaExcusedWindowToMonitor = sqliteTable(
  "monitor_sla_excused_window_to_monitor",
  {
    monitorSlaExcusedWindowId: integer("monitor_sla_excused_window_id")
      .notNull()
      .references(() => monitorSlaExcusedWindow.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.monitorSlaExcusedWindowId, t.monitorId] }),
    index("monitor_sla_excused_window_to_monitor_monitor_id_idx").on(
      t.monitorId,
    ),
  ],
);

export const monitorSlaExcusedWindowRelations = relations(
  monitorSlaExcusedWindow,
  ({ one, many }) => ({
    monitors: many(monitorSlaExcusedWindowToMonitor),
    policy: one(monitorSlaPolicy, {
      fields: [monitorSlaExcusedWindow.monitorSlaPolicyId],
      references: [monitorSlaPolicy.id],
    }),
    createdByUser: one(user, {
      fields: [monitorSlaExcusedWindow.createdBy],
      references: [user.id],
    }),
  }),
);

export const monitorSlaExcusedWindowToMonitorRelations = relations(
  monitorSlaExcusedWindowToMonitor,
  ({ one }) => ({
    window: one(monitorSlaExcusedWindow, {
      fields: [monitorSlaExcusedWindowToMonitor.monitorSlaExcusedWindowId],
      references: [monitorSlaExcusedWindow.id],
    }),
    monitor: one(monitor, {
      fields: [monitorSlaExcusedWindowToMonitor.monitorId],
      references: [monitor.id],
    }),
  }),
);
