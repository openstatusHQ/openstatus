import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { alertSource } from "../alert_sources";
import { statusReport } from "../status_reports";
import { user } from "../users/user";
import { workspace } from "../workspaces";
import { incidentOrigin, incidentSeverity, incidentStatus } from "./constants";

export { incidentOrigin, incidentSeverity, incidentStatus };

export const incidentTable = sqliteTable(
  "incident",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").default("").notNull(),
    status: text("status", { enum: incidentStatus })
      .default("triage")
      .notNull(),
    severity: text("severity", { enum: incidentSeverity })
      .default("warning")
      .notNull(),
    origin: text("origin", { enum: incidentOrigin }).notNull(),

    // Identity across firing/resolved webhooks, taken from the provider's own
    // group identity (Alertmanager groupKey, Grafana rule UID).
    fingerprint: text("fingerprint"),
    alertSourceId: integer("alert_source_id").references(() => alertSource.id, {
      onDelete: "set null",
    }),

    // Set once the incident has been published as a public status report.
    statusReportId: integer("status_report_id").references(
      () => statusReport.id,
      { onDelete: "set null" },
    ),

    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    // Refreshed on every firing signal; drives the staleness sweep.
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
    acknowledgedBy: integer("acknowledged_by").references(() => user.id),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolvedBy: integer("resolved_by").references(() => user.id),
    autoResolved: integer("auto_resolved", { mode: "boolean" })
      .default(false)
      .notNull(),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    index("incident_workspace_id_started_at_idx").on(
      t.workspaceId,
      t.startedAt,
    ),
    // Makes a duplicate open incident per source-group unrepresentable, which is
    // what keeps a repeated firing webhook idempotent at the incident level.
    uniqueIndex("incident_open_fingerprint_idx")
      .on(t.alertSourceId, t.fingerprint)
      .where(sql`${t.resolvedAt} IS NULL AND ${t.fingerprint} IS NOT NULL`),
  ],
);

export const incidentRelations = relations(incidentTable, ({ one }) => ({
  workspace: one(workspace, {
    fields: [incidentTable.workspaceId],
    references: [workspace.id],
  }),
  alertSource: one(alertSource, {
    fields: [incidentTable.alertSourceId],
    references: [alertSource.id],
  }),
  statusReport: one(statusReport, {
    fields: [incidentTable.statusReportId],
    references: [statusReport.id],
  }),
  acknowledgedByUser: one(user, {
    fields: [incidentTable.acknowledgedBy],
    references: [user.id],
  }),
  resolvedByUser: one(user, {
    fields: [incidentTable.resolvedBy],
    references: [user.id],
  }),
}));
