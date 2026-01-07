import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../users";
import { workspace } from "../workspaces";

export const apiKey = sqliteTable(
  "api_key",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description"),
    prefix: text("prefix").notNull().unique(),
    hashedToken: text("hashed_token").notNull().unique(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  },
  (table) => ({
    prefixIdx: index("api_key_prefix_idx").on(table.prefix),
  }),
);

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
  workspace: one(workspace, {
    fields: [apiKey.workspaceId],
    references: [workspace.id],
  }),
  createdBy: one(user, {
    fields: [apiKey.createdById],
    references: [user.id],
  }),
}));
