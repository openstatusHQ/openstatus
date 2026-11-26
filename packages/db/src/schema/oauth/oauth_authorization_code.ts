import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { Scope } from "../api-keys/constants";
import { user } from "../users";
import { workspace } from "../workspaces";
import { oauthClient } from "./oauth_client";
import { oauthGrant } from "./oauth_grant";

export const oauthAuthorizationCode = sqliteTable(
  "oauth_authorization_code",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    hash: text("hash").notNull(),
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
    uniqueIndex("oauth_authorization_code_hash_unique").on(t.hash),
    index("oauth_authorization_code_expires_at_idx").on(t.expiresAt),
    index("oauth_authorization_code_client_id_idx").on(t.clientId),
  ],
);
