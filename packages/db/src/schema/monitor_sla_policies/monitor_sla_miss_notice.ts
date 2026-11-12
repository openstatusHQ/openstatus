import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { workspace } from "../workspaces/workspace";
import { monitorSlaPolicy } from "./monitor_sla_policy";

/** Claim for the one "missed target" email per policy and sealed month. */
export const monitorSlaMissNotice = sqliteTable(
  "monitor_sla_miss_notice",
  {
    monitorSlaPolicyId: integer("monitor_sla_policy_id")
      .notNull()
      .references(() => monitorSlaPolicy.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // UTC first-of-month, YYYY-MM-01
    month: text("month").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [primaryKey({ columns: [t.monitorSlaPolicyId, t.month] })],
);
