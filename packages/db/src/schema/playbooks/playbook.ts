import { relations, sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "../users";
import { workspace } from "../workspaces";
import type { PlaybookVariables } from "./variables";

// Autoincrement: audit rows are the history of a deleted playbook, so its id must never be reused.
export const playbook = sqliteTable(
  "playbook",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    content: text("content").notNull(),
    variables: text("variables", { mode: "json" }).$type<PlaybookVariables>(),
    createdBy: integer("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedBy: integer("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    uniqueIndex("playbook_workspace_id_slug_idx").on(t.workspaceId, t.slug),
  ],
);

export const playbookRelations = relations(playbook, ({ one }) => ({
  workspace: one(workspace, {
    fields: [playbook.workspaceId],
    references: [workspace.id],
  }),
  createdByUser: one(user, {
    fields: [playbook.createdBy],
    references: [user.id],
    relationName: "playbookCreatedBy",
  }),
  updatedByUser: one(user, {
    fields: [playbook.updatedBy],
    references: [user.id],
    relationName: "playbookUpdatedBy",
  }),
}));
