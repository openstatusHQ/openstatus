import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Every client is public (token_endpoint_auth_method "none"), so there is
// no secret column. Confidential clients are a follow-up.
export const oauthClient = sqliteTable(
  "oauth_client",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: text("client_id").notNull(),
    name: text("name").notNull().default("MCP Client"),
    redirectUris: text("redirect_uris", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [uniqueIndex("oauth_client_client_id_unique").on(t.clientId)],
);
