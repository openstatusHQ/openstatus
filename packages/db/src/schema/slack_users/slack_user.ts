import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
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
    uniqueIndex(
      "slack_user_workspace_id_slack_team_id_slack_user_id_unique",
    ).on(t.workspaceId, t.slackTeamId, t.slackUserId),
    index("slack_user_user_id_idx").on(t.userId),
  ],
);
