import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { page } from "./page";
import { workspace } from "./workspace";

export const monitor = sqliteTable("monitor", {
  id: integer("id").primaryKey(),
  jobType: text("job_type", ["website", "cron", "other"])
    .default("other")
    .notNull(),
  periodicity: text("periodicity", ["1m", "5m", "10m", "30m", "1h", "other"])
    .default("other")
    .notNull(),
  status: text("status", ["active", "inactive"]).default("inactive").notNull(),
  active: integer("active", { mode: "boolean" }).default(false),

  url: text("url", { length: 512 }).notNull(),

  name: text("name", { length: 256 }).default("").notNull(),
  description: text("description").default("").notNull(),

  pageId: integer("page_id").references(() => page.id),
  workspaceId: integer("workspace_id").references(() => workspace.id),

  createdAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
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
export const selectMonitorSchema = createSelectSchema(monitor, {
  periodicity: periodicityEnum,
});
