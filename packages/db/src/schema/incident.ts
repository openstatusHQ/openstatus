import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { page } from "./page";

export const incident = sqliteTable("incident", {
  id: integer("id").primaryKey(),

  status: text("status", ["resolved", "investigating"]).notNull(),

  pageId: integer("page_id")
    .notNull()
    .references(() => page.id),

  createdAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const incidentUpdate = sqliteTable("incidentUpdate", {
  id: integer("id").primaryKey(),

  date: integer("incident_date"),
  title: text("title", { length: 256 }), // title of the incident
  message: text("message"), //  where we can write the incident message

  incidentId: integer("incident_id")
    .references(() => incident.id)
    .notNull(),
  createdAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const incidentRelations = relations(incident, ({ one, many }) => ({
  page: one(page, {
    fields: [incident.pageId],
    references: [page.id],
  }),
  incidentUpdates: many(incidentUpdate),
}));

export const incidentUpdateRelations = relations(incidentUpdate, ({ one }) => ({
  incident: one(incident, {
    fields: [incidentUpdate.incidentId],
    references: [incident.id],
  }),
}));

// Schema for inserting a Incident - can be used to validate API requests
export const insertIncidentSchema = createInsertSchema(incident);

// Schema for selecting a Incident - can be used to validate API responses
export const selectIncidentSchema = createSelectSchema(incident);

export const insertIncidentUpdateSchema = createInsertSchema(incidentUpdate);

export const selectIncidentUpdateSchema = createSelectSchema(incidentUpdate);
