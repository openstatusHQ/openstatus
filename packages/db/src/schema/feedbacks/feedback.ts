import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../users";
import { workspace } from "../workspaces";
import { feedbackSource, feedbackType } from "./constants";

export const feedback = sqliteTable(
  "feedback",
  {
    id: integer("id").primaryKey(),

    workspaceId: integer("workspace_id")
      .references(() => workspace.id, { onDelete: "cascade" })
      .notNull(),
    userId: integer("user_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),

    source: text("source", { enum: feedbackSource }).notNull(),
    message: text("message").notNull(),
    type: text("type", { enum: feedbackType }),
    blocker: integer("blocker", { mode: "boolean" }),
    path: text("path").notNull(),
    metadata: text("metadata"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (t) => [index("feedback_workspace_id_idx").on(t.workspaceId)],
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  workspace: one(workspace, {
    fields: [feedback.workspaceId],
    references: [workspace.id],
  }),
  user: one(user, {
    fields: [feedback.userId],
    references: [user.id],
  }),
}));
