import { relations } from "drizzle-orm";
import {
  int,
  mysqlTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

import { workspace } from "./workspace";

export const user = mysqlTable("user", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: varchar("tenant_id", { length: 256 }), // the clerk User Id

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const userRelations = relations(user, ({ many }) => ({
  usersToWorkspaces: many(usersToWorkspaces),
}));

export const usersToWorkspaces = mysqlTable(
  "users_to_workspaces",
  {
    userId: int("user_id").notNull(),
    workspaceId: int("workspace_id").notNull(),
  },
  (t) => ({
    pk: primaryKey(t.userId, t.workspaceId),
  }),
);
