import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { incident, selectIncidentSchema } from "./incident";
import { monitor, selectMonitorSchema } from "./monitor";
import { workspace } from "./workspace";

export const page = sqliteTable("page", {
  id: integer("id").primaryKey(),

  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspace.id),

  title: text("title").notNull(), // title of the page
  description: text("description").notNull(), // description of the page
  icon: text("icon", { length: 256 }), // icon of the page
  slug: text("slug", { length: 256 }).notNull().unique(), // which is used for https://slug.openstatus.dev
  customDomain: text("custom_domain", { length: 256 }).unique(),

  createdAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const pageRelations = relations(page, ({ many, one }) => ({
  incidents: many(incident),
  workspace: one(workspace, {
    fields: [page.workspaceId],
    references: [workspace.id],
  }),
  monitors: many(monitor),
}));

// Schema for inserting a Page - can be used to validate API requests
export const insertPageSchema = createInsertSchema(page, {
  customDomain: z.string().optional(),
  slug: z.string().min(3), // minimum subdomain length
});

// Schema for selecting a Page - can be used to validate API responses
export const selectPageSchema = createSelectSchema(page);
