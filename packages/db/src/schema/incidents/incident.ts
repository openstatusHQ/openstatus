import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const statusIncident = [
  "triage",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "duplicated",
] as const;

export const severityIncident = ["critical", "high", "medium", "low"] as const;

export const incidentKind = ["incident", "test"] as const;

export const incidentTable = sqliteTable("incident", {
  id: integer("id").primaryKey(),
  title: text("title").default("").notNull(),
  summary: text("summary").default("").notNull(),
  status: text("status", { enum: statusIncident }).default("triage").notNull(),
  severity: text("severity", { enum: severityIncident }).notNull(),
  incidentKind: text("incident_kind", { enum: incidentKind })
    .default("incident")
    .notNull(),

  // Incident channel id can be discord, slack, etc
  channelId: text("channel_id"),
  channelName: text("channel_name"),

  // Incident creator email
  createdBy: text("created_by").notNull(),

  // Service affected by incident
  serviceId: integer("service_id"),

  // This is based on the ICM (Incident Command Model)

  // Commander of incident (optional) the id of the user
  commanderId: integer("commander_id"),

  // Communication Lead
  communicationLeadId: integer("communication_lead_id"),

  // Ops lead
  opsLeadId: integer("ops_lead_id"),

  // Data related to incident timeline
  startedAt: integer("started_at", { mode: "timestamp" }),
  detectedAt: integer("dectected_at", { mode: "timestamp" }),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
  mitigatedAt: integer("mitigated_at", { mode: "timestamp" }),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
});
