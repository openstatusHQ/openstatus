import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { Scope } from "../api-keys/constants";
import { user } from "../users";
import { workspace } from "../workspaces";
import { oauthClient } from "./oauth_client";

// One row per consent. Access and refresh token share the row because they
// are one-to-one and rotate together.
export const oauthGrant = sqliteTable(
  "oauth_grant",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    scope: text("scope", { mode: "json" }).$type<Scope[]>().notNull(),
    accessTokenHash: text("access_token_hash").notNull().unique(),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }).notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull().unique(),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }).notNull(),
    // Grace window: the hash rotated out at `rotatedAt` stays valid briefly
    // so two concurrent refreshes do not kill the grant.
    previousRefreshTokenHash: text("previous_refresh_token_hash"),
    rotatedAt: integer("rotated_at", { mode: "timestamp" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    index("oauth_grant_workspace_id_idx").on(t.workspaceId),
    // One client id is shared by every user of Claude / Cursor, so the
    // re-consent lookup needs the user in the key.
    index("oauth_grant_client_id_user_id_idx").on(t.clientId, t.userId),
    index("oauth_grant_user_id_idx").on(t.userId),
    index("oauth_grant_previous_refresh_token_hash_idx").on(
      t.previousRefreshTokenHash,
    ),
    index("oauth_grant_refresh_token_expires_at_idx").on(
      t.refreshTokenExpiresAt,
    ),
  ],
);

export const oauthGrantRelations = relations(oauthGrant, ({ one }) => ({
  client: one(oauthClient, {
    fields: [oauthGrant.clientId],
    references: [oauthClient.clientId],
  }),
  user: one(user, {
    fields: [oauthGrant.userId],
    references: [user.id],
  }),
  workspace: one(workspace, {
    fields: [oauthGrant.workspaceId],
    references: [workspace.id],
  }),
}));
