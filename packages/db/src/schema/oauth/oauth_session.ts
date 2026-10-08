import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { Scope } from "../api-keys/constants";
import { oauthClient } from "./oauth_client";

// Pending authorize request. Lives in a row (not memory) because the server
// runs several instances and the consent page is served by the dashboard.
export const oauthSession = sqliteTable(
  "oauth_session",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope", { mode: "json" }).$type<Scope[]>().notNull(),
    state: text("state"),
    resource: text("resource"),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method", { enum: ["S256"] })
      .notNull()
      .default("S256"),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("oauth_session_client_id_idx").on(t.clientId),
    index("oauth_session_expires_at_idx").on(t.expiresAt),
  ],
);

export const oauthSessionRelations = relations(oauthSession, ({ one }) => ({
  client: one(oauthClient, {
    fields: [oauthSession.clientId],
    references: [oauthClient.clientId],
  }),
}));
