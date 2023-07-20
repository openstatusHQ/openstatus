import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { page } from "./page";
import { usersToWorkspaces } from "./user";

export const workspace = sqliteTable("workspace", {
  id: integer("id").primaryKey(),

  stripeId: text("stripe_id", { length: 256 }),
  name: text("name"),

  createdAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const workspaceRelations = relations(workspace, ({ many }) => ({
  usersToWorkspaces: many(usersToWorkspaces),
  pages: many(page),
}));
