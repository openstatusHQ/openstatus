import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { AdapterAccount } from "next-auth/adapters";

import { workspace, workspaceRole } from "../workspaces";

export const user = sqliteTable("user", {
  id: integer("id").primaryKey(),

  // clerk fields
  tenantId: text("tenant_id", { length: 256 }).unique(), // the clerk User Id
  firstName: text("first_name").default(""),
  lastName: text("last_name").default(""),
  photoUrl: text("photo_url").default(""),

  // next-auth fields
  name: text("name"),
  email: text("email").default(""),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),

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
      .references(() => user.id),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id),
    role: text("role", { enum: workspaceRole }).notNull().default("member"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.workspaceId] }),
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

// NEXT AUTH TABLES

export const account = sqliteTable(
  "account",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const session = sqliteTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationToken = sqliteTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);
