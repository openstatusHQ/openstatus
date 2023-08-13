import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-zod";

import { page } from "./page";
import { usersToWorkspaces } from "./user";

const plan = ["free", "pro", "enterprise"] as const;

export const workspace = sqliteTable("workspace", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(), // we love random words
  name: text("name"),

  stripeId: text("stripe_id", { length: 256 }).unique(),
  subscriptionId: text("subscription_id"),
  plan: text("plan", plan).default("free"),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  paidUntil: integer("paid_until", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
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

export const selectWorkspaceSchema = createSelectSchema(workspace);
