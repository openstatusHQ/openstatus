
import { relations } from "drizzle-orm";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { workspace } from "../workspaces";
import { user } from "../users";

export const apiKey = sqliteTable("api_key", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  createdById: text("created_by_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

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

export const selectApiKeySchema = createSelectSchema(apiKey);
export const insertApiKeySchema = createInsertSchema(apiKey);

export type ApiKey = z.infer<typeof selectApiKeySchema>;
export type NewApiKey = z.infer<typeof insertApiKeySchema>;
