import {
  mysqlTable,
  varchar,
  int,
  timestamp,
  text,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { incident } from "./incident";

import { monitor } from "./monitor";

export const page = mysqlTable("page", {
  id: int("id").autoincrement().primaryKey(),

  workspaceId: int("workspace_id").notNull(),

  title: text("title"), // title of the page
  icon: varchar("icon", { length: 256 }), // icon of the page
  slug: varchar("slug", { length: 256 }), // which is used for https://slug.openstatus.dev
  customDomain: varchar("custom_domain", { length: 256 }),

  // We should store settings of the page
  // theme

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().onUpdateNow(),
});

export const pageRelations = relations(page, ({ many, one }) => ({
  incidents: many(incident),
  workspace: one(page, {
    fields: [page.workspaceId],
    references: [page.id],
  }),
  monitors: many(monitor),
}));
