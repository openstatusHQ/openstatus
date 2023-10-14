import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { pagesToIncidents } from "./incident";
import { monitorsToPages } from "./monitor";
import { workspace } from "./workspace";

export const page = sqliteTable("page", {
  id: integer("id").primaryKey(),

  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),

  title: text("title").notNull(), // title of the page
  description: text("description").notNull(), // description of the page
  icon: text("icon", { length: 256 }).default(""), // icon of the page
  slug: text("slug", { length: 256 }).notNull().unique(), // which is used for https://slug.openstatus.dev
  customDomain: text("custom_domain", { length: 256 }).notNull(),
  published: integer("published", { mode: "boolean" }).default(false),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const pageRelations = relations(page, ({ many, one }) => ({
  monitorsToPages: many(monitorsToPages),
  pagesToIncidents: many(pagesToIncidents),
  workspace: one(workspace, {
    fields: [page.workspaceId],
    references: [workspace.id],
  }),
}));

const slugSchema = z
  .string()
  .regex(
    new RegExp("^[A-Za-z0-9-]+$"),
    "Only use digits (0-9), hyphen (-) or characters (A-Z, a-z).",
  )
  .min(3)
  .toLowerCase();

const customDomainSchema = z
  .string()
  .regex(
    new RegExp("^(?!https?://|www.)([a-zA-Z0-9]+(.[a-zA-Z0-9]+)+.*)$"),
    "Should not start with http://, https:// or www.",
  )
  .or(z.enum([""]));

// Schema for inserting a Page - can be used to validate API requests
export const insertPageSchema = createInsertSchema(page, {
  customDomain: customDomainSchema.optional(),
  icon: z.string().optional(),
  slug: slugSchema,
});

export const insertPageSchemaWithMonitors = insertPageSchema.extend({
  customDomain: customDomainSchema.optional().default(""),
  monitors: z.array(z.number()).optional(),
  workspaceSlug: z.string().optional(),
  slug: slugSchema,
});

// Schema for selecting a Page - can be used to validate API responses
export const selectPageSchema = createSelectSchema(page);
export type Page = z.infer<typeof selectPageSchema>;
