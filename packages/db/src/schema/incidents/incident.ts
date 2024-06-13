import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";
import { user } from "../users/user";
import { workspace } from "../workspaces";

export const statusIncident = [
  "triage",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "duplicated",
] as const;

export const incidentTable = sqliteTable(
  "incident",
  {
    id: integer("id").primaryKey(),
    title: text("title").default("").notNull(),
    summary: text("summary").default("").notNull(),
    status: text("status", { enum: statusIncident })
      .default("triage")
      .notNull(),

    // Service affected by incident
    monitorId: integer("monitor_id").references(() => monitor.id, {
      onDelete: "set default",
    }),

    // Workspace where the incident happened
    workspaceId: integer("workspace_id").references(() => workspace.id),
    // Data related to incident timeline
    startedAt: integer("started_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    // Who has acknowledged the incident
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    acknowledgedBy: integer("acknowledged_by").references(() => user.id),

    // Who has resolved it
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolvedBy: integer("resolved_by").references(() => user.id),

    incidentScreenshotUrl: text("incident_screenshot_url"),
    recoveryScreenshotUrl: text("recovery_screenshot_url"),
    // If the incident was auto resolved
    autoResolved: integer("auto_resolved", { mode: "boolean" }).default(false),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (table) => {
    return {
      unique: unique().on(table.monitorId, table.startedAt),
    };
  },
);
