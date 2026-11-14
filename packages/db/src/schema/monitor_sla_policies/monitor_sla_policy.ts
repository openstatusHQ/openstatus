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
import { monitorSlaPolicyTerms } from "./monitor_sla_policy_terms";

export const monitorSlaPolicy = sqliteTable(
  "monitor_sla_policy",
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
  (t) => [index("monitor_sla_policy_workspace_id_idx").on(t.workspaceId)],
);

export const monitorSlaPolicyToMonitor = sqliteTable(
  "monitor_sla_policy_to_monitor",
  {
    monitorSlaPolicyId: integer("monitor_sla_policy_id")
      .notNull()
      .references(() => monitorSlaPolicy.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    // sealing only covers months that ended after the membership began
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    primaryKey({ columns: [t.monitorSlaPolicyId, t.monitorId] }),
    index("monitor_sla_policy_to_monitor_monitor_id_idx").on(t.monitorId),
  ],
);

export const monitorSlaPolicyRelations = relations(
  monitorSlaPolicy,
  ({ one, many }) => ({
    workspace: one(workspace, {
      fields: [monitorSlaPolicy.workspaceId],
      references: [workspace.id],
    }),
    monitors: many(monitorSlaPolicyToMonitor),
    terms: many(monitorSlaPolicyTerms),
  }),
);

export const monitorSlaPolicyToMonitorRelations = relations(
  monitorSlaPolicyToMonitor,
  ({ one }) => ({
    policy: one(monitorSlaPolicy, {
      fields: [monitorSlaPolicyToMonitor.monitorSlaPolicyId],
      references: [monitorSlaPolicy.id],
    }),
    monitor: one(monitor, {
      fields: [monitorSlaPolicyToMonitor.monitorId],
      references: [monitor.id],
    }),
  }),
);
