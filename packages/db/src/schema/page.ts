import { relations } from "drizzle-orm";
import {
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { incident } from "./incident";
import { monitor } from "./monitor";

export const page = mysqlTable("page", {
  id: int("id").autoincrement().primaryKey(),

  workspaceId: int("workspace_id").notNull(),

  title: text("title").notNull(), // title of the page
  description: text("description").notNull(), // description of the page
  icon: varchar("icon", { length: 256 }), // icon of the page
  slug: varchar("slug", { length: 256 }).notNull(), // which is used for https://slug.openstatus.dev
  customDomain: varchar("custom_domain", { length: 256 }).notNull().default(""),

  // We should store settings of the page
  // theme

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const pageRelations = relations(page, ({ many, one }) => ({
  incidents: many(incident),
  workspace: one(page, {
    fields: [page.workspaceId],
    references: [page.id],
  }),
  monitors: many(monitor),
}));

// Schema for inserting a Page - can be used to validate API requests
export const insertPageSchema = createInsertSchema(page, {
  customDomain: z.string().optional(),
});

// Schema for selecting a Page - can be used to validate API responses
export const selectPageSchema = createSelectSchema(page);
