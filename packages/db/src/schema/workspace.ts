import { datetime, mysqlTable, varchar, int } from "drizzle-orm/mysql-core";

export const workspace = mysqlTable("workspace", {
  id: int("id").autoincrement().primaryKey(),

  stripeId: varchar("stripe_id", { length: 256 }),

  userId: int("user_id"),
  pageId: int("page_id"),

  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
});
