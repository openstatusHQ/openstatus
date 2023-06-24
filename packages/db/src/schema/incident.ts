import {
  datetime,
  mysqlTable,
  varchar,
  text,
  mysqlEnum,
  int,
} from "drizzle-orm/mysql-core";

export const incident = mysqlTable("incident", {
  id: int("id").autoincrement().primaryKey(),

  status: mysqlEnum("status", ["resolved", "investigatin", ""]),

  incidentUpdateId: int("incident_update_id"),

  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("update_at").notNull(),
});

export const incidentUpdate = mysqlTable("incidentUpdate", {
  id: int("id").autoincrement().primaryKey(),

  date: datetime("incident_date"),
  title: varchar("title", { length: 256 }), // title of the incident
  message: text("message"), //  where we can write the incident message

  updatedAt: datetime("updated_at").notNull(),
});
