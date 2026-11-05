import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { user } from "../users";
import { workspace } from "../workspaces";

export const slackUser = sqliteTable(
  "slack_user",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    slackTeamId: text("slack_team_id").notNull(),
    slackUserId: text("slack_user_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    unique().on(t.workspaceId, t.slackTeamId, t.slackUserId),
    index("slack_user_user_id_idx").on(t.userId),
  ],
);

export const slackUserRelations = relations(slackUser, ({ one }) => ({
  workspace: one(workspace, {
    fields: [slackUser.workspaceId],
    references: [workspace.id],
  }),
  user: one(user, {
    fields: [slackUser.userId],
    references: [user.id],
  }),
}));
