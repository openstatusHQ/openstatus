import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { maintenance } from "../maintenances";
import { monitorsToPages } from "../monitors";
import { pageComponent } from "../page_components";
import { pageSubscriber } from "../page_subscribers";
import { statusReport } from "../status_reports";
import { workspace } from "../workspaces";
import { pageAccessTypes } from "./constants";

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

  forceTheme: text("force_theme", { enum: ["dark", "light", "system"] })
    .notNull()
    .default("system"),

  // Password protecting the status page - no specific restriction on password
  password: text("password", { length: 256 }),
  // @deprecated: instead, use accessType
  passwordProtected: integer("password_protected", { mode: "boolean" }).default(
    false,
  ),
  accessType: text("access_type", { enum: pageAccessTypes }).default("public"),
  authEmailDomains: text("auth_email_domains", { mode: "text" }), // TODO: change to json

  // links and urls
  homepageUrl: text("homepage_url", { length: 256 }),
  contactUrl: text("contact_url", { length: 256 }),

  legacyPage: integer("legacy_page", { mode: "boolean" })
    .notNull()
    .default(true),
  configuration: text("configuration", { mode: "json" }),

  /**
   * Displays the total and failed request numbers for each monitor
   * TODO: remove this column - we moved into configuration
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
  /** @deprecated Use pageComponents instead. Retained for backwards compatibility. */
  monitorsToPages: many(monitorsToPages),
  pageComponents: many(pageComponent),
  maintenances: many(maintenance),
  statusReports: many(statusReport),
  workspace: one(workspace, {
    fields: [page.workspaceId],
    references: [workspace.id],
  }),
  pageSubscribers: many(pageSubscriber),
}));
