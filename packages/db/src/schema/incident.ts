import { relations } from "drizzle-orm";
import {
  datetime,
  mysqlTable,
  varchar,
  text,
  mysqlEnum,
  int,
  timestamp,
} from "drizzle-orm/mysql-core";
import { page } from "./page";

export const incident = mysqlTable("incident", {
  id: int("id").autoincrement().primaryKey(),

  status: mysqlEnum("status", ["resolved", "investigatin", ""]),

  pageId: int("page_id"),

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
