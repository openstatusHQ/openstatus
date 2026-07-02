import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors/monitor";
import { workspace } from "../workspaces/workspace";
import type { FrozenMonitorUptimeDay } from "./validation";

export const frozenMonitorUptime = sqliteTable(
  "frozen_monitor_uptime",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    // UTC first-of-month, YYYY-MM-01
    month: text("month").notNull(),
    days: text("days", { mode: "json" })
      .$type<FrozenMonitorUptimeDay[]>()
      .notNull(),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    // idempotency key: re-freezing a month is a silent no-op
    unique("frozen_monitor_uptime_monitor_id_month_unique").on(
      t.monitorId,
      t.month,
    ),
    index("frozen_monitor_uptime_workspace_id_idx").on(t.workspaceId),
  ],
);

export const frozenMonitorUptimeRelations = relations(
  frozenMonitorUptime,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [frozenMonitorUptime.monitorId],
      references: [monitor.id],
    }),
    workspace: one(workspace, {
      fields: [frozenMonitorUptime.workspaceId],
      references: [workspace.id],
    }),
  }),
);
