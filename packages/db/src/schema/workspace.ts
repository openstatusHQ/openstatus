import { datetime, mysqlTable, serial, varchar } from "drizzle-orm/mysql-core";
import { user } from "./user";
import { page } from "./page";

export const workspace = mysqlTable("workspace", {
  id: serial("id").primaryKey(),

  stripeId: varchar("stripe_id", { length: 256 }),

  userId: serial("id").references(() => user.id),
  pageId: serial("id").references(() => page.id),

  createdAt: datetime("created_at").default(new Date()),
  updateAt: datetime("update_at"),
});
function integer(arg0: string) {
  throw new Error("Function not implemented.");
}
