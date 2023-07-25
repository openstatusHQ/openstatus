import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { workspace } from "./workspace";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id", { length: 256 }).unique(), // the clerk User Id

  createdAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const userRelations = relations(user, ({ many }) => ({
  usersToWorkspaces: many(usersToWorkspaces),
}));

export const usersToWorkspaces = sqliteTable(
  "users_to_workspaces",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
  },
  (t) => ({
    pk: primaryKey(t.userId, t.workspaceId),
  }),
);

export const usersToWorkspaceRelations = relations(
  usersToWorkspaces,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [usersToWorkspaces.workspaceId],
      references: [workspace.id],
    }),
    user: one(user, {
      fields: [usersToWorkspaces.userId],
      references: [user.id],
    }),
  }),
);
