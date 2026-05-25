import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../users";
import { workspace } from "../workspaces";
import type { ChatStoredMessage } from "./messages";

/**
 * Surrogate-PK row per dashboard chat conversation. Many rows per
 * (workspace, user). Bounded by application logic on insert
 * (`MAX_CHAT_SESSIONS_PER_USER`); per-row payload bounded by
 * `MAX_CHAT_MESSAGES` and a tool-result compaction policy in the service
 * layer.
 */
export const chatSession = sqliteTable(
  "chat_session",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    messages: text("messages", { mode: "json" })
      .$type<ChatStoredMessage[]>()
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    // Sidebar / picker query: list a user's conversations newest first.
    // Also covers the cap-enforcement query ("oldest row for this pair").
    index("chat_session_workspace_user_updated_idx").on(
      t.workspaceId,
      t.userId,
      t.updatedAt,
    ),
  ],
);

export type ChatSessionRow = typeof chatSession.$inferSelect;
export type NewChatSessionRow = typeof chatSession.$inferInsert;
