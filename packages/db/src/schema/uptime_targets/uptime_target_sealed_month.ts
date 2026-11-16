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
import type { UptimeTargetExcusedWindowKind } from "./constants";
import { uptimeTarget } from "./uptime_target";

export type UptimeTargetSealedWindow = {
  id: number;
  kind: UptimeTargetExcusedWindowKind;
  reason: string;
  /** epoch ms */
  from: number;
  to: number;
};

/** A (policy, monitor, month) result frozen with the terms that applied. */
export const uptimeTargetSealedMonth = sqliteTable(
  "uptime_target_sealed_month",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    uptimeTargetId: integer("uptime_target_id")
      .notNull()
      .references(() => uptimeTarget.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    // first of the month in time_zone, YYYY-MM-01
    month: text("month").notNull(),
    timeZone: text("time_zone").notNull().default("UTC"),

    target: integer("target").notNull(),
    strict: integer("strict", { mode: "boolean" }).notNull(),

    // the windows that applied, as they were when the month sealed
    excusedWindows: text("excused_windows", { mode: "json" })
      .$type<UptimeTargetSealedWindow[]>()
      .notNull()
      .default(sql`'[]'`),
    // thousandths of a percent, floored; null when nothing was measured
    uptime: integer("uptime"),
    met: integer("met", { mode: "boolean" }),
    measuredMs: integer("measured_ms").notNull(),
    downMs: integer("down_ms").notNull(),
    excusedMs: integer("excused_ms").notNull(),
    unmeasuredMs: integer("unmeasured_ms").notNull(),
    // thousandths of a percent, floored
    coverage: integer("coverage"),

    sealedAt: integer("sealed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    // write-once key: a second seal of the same pair and month is a no-op
    unique("uptime_target_sealed_month_target_monitor_month_unique").on(
      t.uptimeTargetId,
      t.monitorId,
      t.month,
    ),
    index("uptime_target_sealed_month_workspace_id_idx").on(t.workspaceId),
    index("uptime_target_sealed_month_monitor_id_idx").on(t.monitorId),
  ],
);

export const uptimeTargetSealedMonthRelations = relations(
  uptimeTargetSealedMonth,
  ({ one }) => ({
    policy: one(uptimeTarget, {
      fields: [uptimeTargetSealedMonth.uptimeTargetId],
      references: [uptimeTarget.id],
    }),
    monitor: one(monitor, {
      fields: [uptimeTargetSealedMonth.monitorId],
      references: [monitor.id],
    }),
  }),
);
