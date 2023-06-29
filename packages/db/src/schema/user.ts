import { relations } from "drizzle-orm";
import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";
import { workspace } from "./workspace";

export const user = mysqlTable("user", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: varchar("tenant_id", { length: 256 }), // the clerk User Id

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const userRelations = relations(user, ({ many }) => ({
  workspace: many(workspace),
}));
