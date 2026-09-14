import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { Scope } from "../api-keys/constants";
import { user } from "../users";
import { workspace } from "../workspaces";
import { oauthClient } from "./oauth_client";
import { oauthGrant } from "./oauth_grant";

export const oauthAuthorizationCode = sqliteTable(
  "oauth_authorization_code",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    hash: text("hash").notNull().unique(),
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
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp" }),
    // Set on exchange so a replayed code can revoke the grant it produced.
    grantId: integer("grant_id").references(() => oauthGrant.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("oauth_authorization_code_expires_at_idx").on(t.expiresAt),
    index("oauth_authorization_code_client_id_idx").on(t.clientId),
  ],
);

export const oauthAuthorizationCodeRelations = relations(
  oauthAuthorizationCode,
  ({ one }) => ({
    client: one(oauthClient, {
      fields: [oauthAuthorizationCode.clientId],
      references: [oauthClient.clientId],
    }),
    grant: one(oauthGrant, {
      fields: [oauthAuthorizationCode.grantId],
      references: [oauthGrant.id],
    }),
    user: one(user, {
      fields: [oauthAuthorizationCode.userId],
      references: [user.id],
    }),
    workspace: one(workspace, {
      fields: [oauthAuthorizationCode.workspaceId],
      references: [workspace.id],
    }),
  }),
);
