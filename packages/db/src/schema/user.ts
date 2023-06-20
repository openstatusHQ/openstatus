import { mysqlTable, varchar, json, datetime } from "drizzle-orm/mysql-core";

export const policies = mysqlTable("user", {
  id: varchar("id", { length: 256 }).primaryKey(),
});
