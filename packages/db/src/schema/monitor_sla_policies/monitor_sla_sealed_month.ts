import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors/monitor";
import { workspace } from "../workspaces/workspace";
import {
  type MonitorSlaCreditSchedule,
  type MonitorSlaExcusedWindowKind,
  monitorSlaMethods,
} from "./constants";
import { monitorSlaPolicy } from "./monitor_sla_policy";
import { monitorSlaSealedEpisode } from "./monitor_sla_sealed_episode";

export type MonitorSlaSealedWindow = {
  id: number;
  kind: MonitorSlaExcusedWindowKind;
  reason: string;
  /** epoch ms */
  from: number;
  to: number;
};

/** A (policy, monitor, month) result frozen with the terms that applied. */
export const monitorSlaSealedMonth = sqliteTable(
  "monitor_sla_sealed_month",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    monitorSlaPolicyId: integer("monitor_sla_policy_id")
      .notNull()
      .references(() => monitorSlaPolicy.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    // first of the month in time_zone, YYYY-MM-01
    month: text("month").notNull(),
    method: text("method", { enum: monitorSlaMethods })
      .notNull()
      .default("time"),
    timeZone: text("time_zone").notNull().default("UTC"),

    target: integer("target").notNull(),
    strict: integer("strict", { mode: "boolean" }).notNull(),
    // the credit schedule it was judged with; null without one
    creditSchedule: text("credit_schedule", {
      mode: "json",
    }).$type<MonitorSlaCreditSchedule>(),

    ok: integer("ok").notNull(),
    degraded: integer("degraded").notNull(),
    error: integer("error").notNull(),
    // run verdicts inside the excused windows, dropped from both sides
    excusedOk: integer("excused_ok").notNull().default(0),
    excusedDegraded: integer("excused_degraded").notNull().default(0),
    excusedError: integer("excused_error").notNull().default(0),
    // the windows that applied, as they were when the month sealed
    excusedWindows: text("excused_windows", { mode: "json" })
      .$type<MonitorSlaSealedWindow[]>()
      .notNull()
      .default(sql`'[]'`),
    total: integer("total").notNull(),
    up: integer("up").notNull(),
    // thousandths of a percent, floored; null when every run was excused
    uptime: integer("uptime"),
    met: integer("met", { mode: "boolean" }),
    // method "time" only; null on run-count rows
    measuredMs: integer("measured_ms"),
    downMs: integer("down_ms"),
    excusedMs: integer("excused_ms"),
    unmeasuredMs: integer("unmeasured_ms"),
    // thousandths of a percent, floored
    coverage: integer("coverage"),
    // percent of monthly fees; null without a schedule or a judgement
    creditPct: real("credit_pct"),
    creditSteps: integer("credit_steps"),

    sealedAt: integer("sealed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    // write-once key: a second seal of the same pair and month is a no-op
    unique("monitor_sla_sealed_month_policy_monitor_month_unique").on(
      t.monitorSlaPolicyId,
      t.monitorId,
      t.month,
    ),
    index("monitor_sla_sealed_month_workspace_id_idx").on(t.workspaceId),
    index("monitor_sla_sealed_month_monitor_id_idx").on(t.monitorId),
  ],
);

export const monitorSlaSealedMonthRelations = relations(
  monitorSlaSealedMonth,
  ({ one, many }) => ({
    policy: one(monitorSlaPolicy, {
      fields: [monitorSlaSealedMonth.monitorSlaPolicyId],
      references: [monitorSlaPolicy.id],
    }),
    monitor: one(monitor, {
      fields: [monitorSlaSealedMonth.monitorId],
      references: [monitor.id],
    }),
    episodes: many(monitorSlaSealedEpisode),
  }),
);
