import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";
import { page } from "../pages";
import { workspace } from "../workspaces";

export const incidentStatus = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;

export const incident = sqliteTable("incident", {
  id: integer("id").primaryKey(),
  status: text("status", { enum: incidentStatus }).notNull(),
  title: text("title", { length: 256 }).notNull(),

  workspaceId: integer("workspace_id").references(() => workspace.id),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const incidentUpdate = sqliteTable("incident_update", {
  id: integer("id").primaryKey(),

  status: text("status", incidentStatus).notNull(),
  date: integer("date", { mode: "timestamp" }).notNull(),
  message: text("message").notNull(),

  incidentId: integer("incident_id")
    .references(() => incident.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const incidentRelations = relations(incident, ({ one, many }) => ({
  monitorsToIncidents: many(monitorsToIncidents),
  pagesToIncidents: many(pagesToIncidents),
  incidentUpdates: many(incidentUpdate),
  workspace: one(workspace, {
    fields: [incident.workspaceId],
    references: [workspace.id],
  }),
}));

export const incidentUpdateRelations = relations(incidentUpdate, ({ one }) => ({
  incident: one(incident, {
    fields: [incidentUpdate.incidentId],
    references: [incident.id],
  }),
}));

export const monitorsToIncidents = sqliteTable(
  "incidents_to_monitors",
  {
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incident.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey(t.monitorId, t.incidentId),
  }),
);

export const monitorsToIncidentsRelations = relations(
  monitorsToIncidents,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [monitorsToIncidents.monitorId],
      references: [monitor.id],
    }),
    incident: one(incident, {
      fields: [monitorsToIncidents.incidentId],
      references: [incident.id],
    }),
  }),
);

export const pagesToIncidents = sqliteTable(
  "incidents_to_pages",
  {
    pageId: integer("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incident.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey(t.pageId, t.incidentId),
  }),
);

export const pagesToIncidentsRelations = relations(
  pagesToIncidents,
  ({ one }) => ({
    page: one(page, {
      fields: [pagesToIncidents.pageId],
      references: [page.id],
    }),
    incident: one(incident, {
      fields: [pagesToIncidents.incidentId],
      references: [incident.id],
    }),
  }),
);
