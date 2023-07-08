import { relations } from "drizzle-orm";
import {
  datetime,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { page } from "./page";

export const incident = mysqlTable("incident", {
  id: int("id").autoincrement().primaryKey(),

  status: mysqlEnum("status", ["resolved", "investigating"]).notNull(),

  pageId: int("page_id").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().onUpdateNow(),
});

export const incidentUpdate = mysqlTable("incidentUpdate", {
  id: int("id").autoincrement().primaryKey(),

  date: datetime("incident_date"),
  title: varchar("title", { length: 256 }), // title of the incident
  message: text("message"), //  where we can write the incident message

  incidentId: int("incident_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
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
