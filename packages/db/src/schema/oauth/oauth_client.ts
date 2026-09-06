import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { oauthAuthorizationCode } from "./oauth_authorization_code";
import { oauthGrant } from "./oauth_grant";
import { oauthSession } from "./oauth_session";

// Every client is public (token_endpoint_auth_method "none"), so there is
// no secret column. Confidential clients are a follow-up.
export const oauthClient = sqliteTable("oauth_client", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id").notNull().unique(),
  name: text("name").notNull().default("MCP Client"),
  redirectUris: text("redirect_uris", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const oauthClientRelations = relations(oauthClient, ({ many }) => ({
  sessions: many(oauthSession),
  authorizationCodes: many(oauthAuthorizationCode),
  grants: many(oauthGrant),
}));
