import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { maintenance } from "../maintenances";
import { monitorsToPages } from "../monitors";
import { statusReport } from "../status_reports";
import { workspace } from "../workspaces";

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

  // Password protecting the status page - no specific restriction on password
  password: text("password", { length: 256 }),
  passwordProtected: integer("password_protected", { mode: "boolean" }).default(
    false,
  ),

  /**
   * Displays the total and failed request numbers for each monitor
   */
  showMonitorValues: integer("show_monitor_values", {
    mode: "boolean",
  }).default(true),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const pageRelations = relations(page, ({ many, one }) => ({
  monitorsToPages: many(monitorsToPages),
  maintenancesToPages: many(maintenance),
  statusReports: many(statusReport),
  workspace: one(workspace, {
    fields: [page.workspaceId],
    references: [workspace.id],
  }),
}));
