import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";
import { user } from "../users/user";
import { workspace } from "../workspaces";

export const monitorIncidentStatus = [
  "triage",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "duplicated",
] as const;

export const monitorIncidentTable = sqliteTable(
  "monitor_incident",
  {
    id: integer("id").primaryKey(),
    title: text("title").default("").notNull(),
    summary: text("summary").default("").notNull(),
    status: text("status", { enum: monitorIncidentStatus })
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

    // An excused outage counts as up and is hidden from public surfaces
    excusedAt: integer("excused_at", { mode: "timestamp" }),
    excusedBy: integer("excused_by").references(() => user.id, {
      onDelete: "set null",
    }),
    excusedReason: text("excused_reason"),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (table) => [
    unique().on(table.monitorId, table.startedAt),
    index("monitor_incident_workspace_id_started_at_idx").on(
      table.workspaceId,
      table.startedAt,
    ),
    // Partial: open incidents are looked up on every check result, every region,
    // every minute. Unique so a monitor cannot hold two open incidents at once.
    uniqueIndex("monitor_incident_open_idx")
      .on(table.monitorId)
      .where(sql`${table.resolvedAt} IS NULL`),
  ],
);

/** Relational `where` for public surfaces: an excused outage counts as up and is never shown. */
export const notExcused = { excusedAt: { isNull: true } } as const;
