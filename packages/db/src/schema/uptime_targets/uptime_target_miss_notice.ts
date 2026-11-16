import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { workspace } from "../workspaces/workspace";
import { uptimeTarget } from "./uptime_target";

/** Claim for the one "missed target" email per policy and sealed month. */
export const uptimeTargetMissNotice = sqliteTable(
  "uptime_target_miss_notice",
  {
    uptimeTargetId: integer("uptime_target_id")
      .notNull()
      .references(() => uptimeTarget.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // UTC first-of-month, YYYY-MM-01
    month: text("month").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [primaryKey({ columns: [t.uptimeTargetId, t.month] })],
);
