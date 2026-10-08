import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { statusReport } from "../status_reports";
import { user } from "../users";
import { workspace } from "../workspaces";
import {
  incidentEventType,
  incidentSeverity,
  incidentStatus,
} from "./constants";

// Autoincrement: audit rows outlive a deleted incident, so its id must never be reused.
export const incident = sqliteTable(
  "incident",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id),
    title: text("title", { length: 256 }).notNull(),
    severity: text("severity", { enum: incidentSeverity }).notNull(),
    status: text("status", { enum: incidentStatus }).notNull().default("open"),
    summary: text("summary"),
    commanderId: integer("commander_id").references(() => user.id),
    declaredBy: integer("declared_by").references(() => user.id),
    declaredAt: integer("declared_at", { mode: "timestamp" }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    mitigatedAt: integer("mitigated_at", { mode: "timestamp" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolvedBy: integer("resolved_by").references(() => user.id),
    closedAt: integer("closed_at", { mode: "timestamp" }),
    statusReportId: integer("status_report_id").references(
      () => statusReport.id,
      { onDelete: "set null" },
    ),
    slackTeamId: text("slack_team_id"),
    slackChannelId: text("slack_channel_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    index("incident_workspace_id_status_idx").on(t.workspaceId, t.status),
    index("incident_workspace_id_declared_at_idx").on(
      t.workspaceId,
      t.declaredAt,
    ),
    uniqueIndex("incident_slack_channel_idx")
      .on(t.slackTeamId, t.slackChannelId)
      .where(sql`${t.slackChannelId} IS NOT NULL`),
    uniqueIndex("incident_status_report_id_idx")
      .on(t.statusReportId)
      .where(sql`${t.statusReportId} IS NOT NULL`),
  ],
);

export const incidentEvent = sqliteTable(
  "incident_event",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incident.id, { onDelete: "cascade" }),
    type: text("type", { enum: incidentEventType }).notNull(),
    message: text("message"),
    createdBy: integer("created_by").references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("incident_event_incident_id_created_at_idx").on(
      t.incidentId,
      t.createdAt,
    ),
  ],
);

export const incidentRelations = relations(incident, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [incident.workspaceId],
    references: [workspace.id],
  }),
  commander: one(user, {
    fields: [incident.commanderId],
    references: [user.id],
    relationName: "incidentCommander",
  }),
  declaredByUser: one(user, {
    fields: [incident.declaredBy],
    references: [user.id],
    relationName: "incidentDeclaredBy",
  }),
  resolvedByUser: one(user, {
    fields: [incident.resolvedBy],
    references: [user.id],
    relationName: "incidentResolvedBy",
  }),
  statusReport: one(statusReport, {
    fields: [incident.statusReportId],
    references: [statusReport.id],
  }),
  events: many(incidentEvent),
}));

export const incidentEventRelations = relations(incidentEvent, ({ one }) => ({
  incident: one(incident, {
    fields: [incidentEvent.incidentId],
    references: [incident.id],
  }),
  createdByUser: one(user, {
    fields: [incidentEvent.createdBy],
    references: [user.id],
  }),
}));
