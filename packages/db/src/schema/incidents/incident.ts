import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";
import { user } from "../users/user";

export const statusIncident = [
  "triage",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "duplicated",
] as const;

export const incidentTable = sqliteTable("incident", {
  id: integer("id").primaryKey(),
  title: text("title").default("").notNull(),
  summary: text("summary").default("").notNull(),
  status: text("status", { enum: statusIncident }).default("triage").notNull(),

  // Service affected by incident
  monitorId: integer("monitor_id").references(() => monitor.id),

  // Data related to incident timeline
  startedAt: integer("started_at", { mode: "timestamp" }),
  // Who has acknoledge the incident
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
  acknowledgedBy: integer("acknowledged_by").references(() => user.id),

  // Who has resolved it
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  resolvedBy: integer("resolved_by").references(() => user.id),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});
