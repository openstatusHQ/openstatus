import { relations } from "drizzle-orm";
import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { page } from "./page";
import { workspace } from "./workspace";

export const monitor = mysqlTable("monitor", {
  id: int("id").autoincrement().primaryKey(),
  jobType: mysqlEnum("job_type", ["website", "cron", "other"])
    .default("other")
    .notNull(),
  periodicity: mysqlEnum("periodicity", [
    "1m",
    "5m",
    "10m",
    "30m",
    "1h",
    "other",
  ])
    .default("other")
    .notNull(),

  // TBD: if we keep or not?!?
  status: mysqlEnum("status", ["active", "inactive"])
    .default("inactive")
    .notNull(),

  active: boolean("active").default(false),

  url: varchar("url", { length: 512 }).notNull(),

  name: varchar("name", { length: 256 }).default("").notNull(),
  description: text("description").default("").notNull(),

  pageId: int("page_id"),
  workspaceId: int("workspace_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updateddAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const monitorRelation = relations(monitor, ({ one }) => ({
  page: one(page, {
    fields: [monitor.pageId],
    references: [page.id],
  }),
  workspace: one(workspace, {
    fields: [monitor.workspaceId],
    references: [workspace.id],
  }),
}));

export const periodicityEnum = z.enum([
  "1m",
  "5m",
  "10m",
  "30m",
  "1h",
  "other",
]);
// Schema for inserting a Monitor - can be used to validate API requests
export const insertMonitorSchema = createInsertSchema(monitor, {
  periodicity: periodicityEnum,
  url: z.string().url(),
});

// Schema for selecting a Monitor - can be used to validate API responses
export const selectMonitorSchema = createSelectSchema(monitor);
