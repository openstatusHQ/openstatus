import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { workspace, workspaceRole } from "../workspaces";

export const user = sqliteTable("user", {
  id: text("id").notNull(),
  primaryKey: integer("primaryKey").primaryKey(),
  tenantId: text("tenant_id", { length: 256 }).unique(), // the clerk User Id

  firstName: text("first_name").default(""),
  lastName: text("last_name").default(""),
  email: text("email").default(""),
  photoUrl: text("photo_url").default(""),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
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
    userId: integer("user_id")
      .notNull()
      .references(() => user.primaryKey),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id),
    role: text("role", { enum: workspaceRole }).notNull().default("member"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
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
      references: [user.primaryKey],
    }),
  }),
);

export const providers = ["github", "google"] as const;

export const oauthAccount = sqliteTable(
  "oauth_account",
  {
    providerId: text("provider_id", { enum: providers }).notNull(),
    providerUserId: text("provider_user_id").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => ({
    providerIdProviderUserId: primaryKey({
      columns: [t.providerId, t.providerUserId],
    }),
  }),
);

export const session = sqliteTable("session", {
  id: text("id").notNull().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  expiresAt: integer("expires_at").notNull(),
});
