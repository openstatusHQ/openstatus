import { datetime, mysqlTable, serial, varchar } from "drizzle-orm/mysql-core";

export const user = mysqlTable("user", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id", { length: 256 }), // the clerk User Id

  createdAt: datetime("created_at").default(new Date()),
  updateAt: datetime("update_at"),
});
