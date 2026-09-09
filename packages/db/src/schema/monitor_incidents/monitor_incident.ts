import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { incidentTable } from "../incidents/incident";
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

    // Rolls this monitor incident up into a workspace incident. Nothing sets it
    // yet; the checker rollup lands in a later release.
    incidentId: integer("incident_id").references(() => incidentTable.id, {
      onDelete: "set null",
    }),
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

export const monitorIncidentRelations = relations(
  monitorIncidentTable,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [monitorIncidentTable.monitorId],
      references: [monitor.id],
    }),
    workspace: one(workspace, {
      fields: [monitorIncidentTable.workspaceId],
      references: [workspace.id],
    }),
    incident: one(incidentTable, {
      fields: [monitorIncidentTable.incidentId],
      references: [incidentTable.id],
    }),
    acknowledgedByUser: one(user, {
      fields: [monitorIncidentTable.acknowledgedBy],
      references: [user.id],
    }),
    resolvedByUser: one(user, {
      fields: [monitorIncidentTable.resolvedBy],
      references: [user.id],
    }),
  }),
);
