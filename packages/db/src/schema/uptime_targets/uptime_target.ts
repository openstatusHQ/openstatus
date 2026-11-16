import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors/monitor";
import { workspace } from "../workspaces/workspace";

export const uptimeTarget = sqliteTable(
  "uptime_target",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // thousandths of a percent: 99.5% is 99500, so comparisons stay integer
    target: integer("target").notNull(),
    // slow checks (above the monitor's degraded threshold) count as down
    strict: integer("strict", { mode: "boolean" }).notNull().default(false),
    // IANA zone that defines month boundaries; locked once a month is sealed
    timeZone: text("time_zone").notNull().default("UTC"),
    // set = read-only, no more sealing, hidden from the default list
    archivedAt: integer("archived_at", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [index("uptime_target_workspace_id_idx").on(t.workspaceId)],
);

export const uptimeTargetToMonitor = sqliteTable(
  "uptime_target_to_monitor",
  {
    uptimeTargetId: integer("uptime_target_id")
      .notNull()
      .references(() => uptimeTarget.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    // sealing only covers months that ended after the membership began
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    primaryKey({ columns: [t.uptimeTargetId, t.monitorId] }),
    index("uptime_target_to_monitor_monitor_id_idx").on(t.monitorId),
  ],
);

export const uptimeTargetRelations = relations(
  uptimeTarget,
  ({ one, many }) => ({
    workspace: one(workspace, {
      fields: [uptimeTarget.workspaceId],
      references: [workspace.id],
    }),
    monitors: many(uptimeTargetToMonitor),
  }),
);

export const uptimeTargetToMonitorRelations = relations(
  uptimeTargetToMonitor,
  ({ one }) => ({
    policy: one(uptimeTarget, {
      fields: [uptimeTargetToMonitor.uptimeTargetId],
      references: [uptimeTarget.id],
    }),
    monitor: one(monitor, {
      fields: [uptimeTargetToMonitor.monitorId],
      references: [monitor.id],
    }),
  }),
);
