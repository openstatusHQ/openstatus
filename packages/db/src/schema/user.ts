import { datetime, mysqlTable, int, varchar } from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: varchar("tenant_id", { length: 256 }), // the clerk User Id

  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
});
