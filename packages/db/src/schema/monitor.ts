import { relations } from "drizzle-orm";
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { page } from "./page";

export const monitor = mysqlTable("monitor", {
  id: int("id").autoincrement().primaryKey(),
  jobType: mysqlEnum("job_type", ["website", "cron", "other"])
    .default("other")
    .notNull(),
  frequency: mysqlEnum("periodicity", ["1m", "5m", "10m", "30m", "1h", "other"])
    .default("other")
    .notNull(),
  status: mysqlEnum("status", ["active", "inactive"])
    .default("inactive")
    .notNull(),

  url: varchar("url", { length: 512 }),

  name: varchar("name", { length: 256 }),
  description: text("description"),

  pageId: int("page_id").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updateddAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const monitorRelation = relations(monitor, ({ one }) => ({
  page: one(page, {
    fields: [monitor.pageId],
    references: [page.id],
  }),
}));

// Schema for inserting a Monitor - can be used to validate API requests
export const insertMonitorSchema = createInsertSchema(monitor);

// Schema for selecting a Monitor - can be used to validate API responses
export const selectMonitorSchema = createSelectSchema(monitor);
