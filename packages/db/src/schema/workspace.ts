import { relations } from "drizzle-orm";
import {
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

import { page } from "./page";
import { user } from "./user";

export const workspace = mysqlTable("workspace", {
  id: int("id").autoincrement().primaryKey(),

  stripeId: varchar("stripe_id", { length: 256 }),
  name: text("name"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const workspaceRelations = relations(workspace, ({ many }) => ({
  page: many(page),
  user: many(user),
}));
