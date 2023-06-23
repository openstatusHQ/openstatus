import {
  datetime,
  mysqlTable,
  serial,
  varchar,
  text,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { statusJob } from "./status-job";

export const incident = mysqlTable("incident", {
  id: serial("id").primaryKey(),

  status: mysqlEnum("status", ["resolved", "investigatin", ""]),

  incidentUpadteId: serial("id").references(() => incidentUpdate.id),

  createdAt: datetime("created_at").default(new Date()),
  updatedAt: datetime("update_at"),
});

export const incidentUpdate = mysqlTable("incidentUpdate", {
  id: serial("id").primaryKey(),

  date: datetime("incident_date"),
  title: varchar("title", { length: 256 }), // title of the incident
  message: text("message"), //  where we can write the incident message

  updatedAt: datetime("updated_at"),
});
