import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../users";
import { workspace } from "../workspaces/workspace";
import { monitorSlaExcusedWindowKinds } from "./constants";
import { monitorSlaPolicy } from "./monitor_sla_policy";

/** [from, to) whose runs count for no monitor of the policy. */
export const monitorSlaExcusedWindow = sqliteTable(
  "monitor_sla_excused_window",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    monitorSlaPolicyId: integer("monitor_sla_policy_id")
      .notNull()
      .references(() => monitorSlaPolicy.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: monitorSlaExcusedWindowKinds }).notNull(),
    reason: text("reason").notNull(),
    from: integer("from", { mode: "timestamp" }).notNull(),
    to: integer("to", { mode: "timestamp" }).notNull(),
    createdBy: integer("created_by").references(() => user.id, {
      onDelete: "set null",
    }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    index("monitor_sla_excused_window_policy_id_idx").on(t.monitorSlaPolicyId),
  ],
);

export const monitorSlaExcusedWindowRelations = relations(
  monitorSlaExcusedWindow,
  ({ one }) => ({
    policy: one(monitorSlaPolicy, {
      fields: [monitorSlaExcusedWindow.monitorSlaPolicyId],
      references: [monitorSlaPolicy.id],
    }),
    createdByUser: one(user, {
      fields: [monitorSlaExcusedWindow.createdBy],
      references: [user.id],
    }),
  }),
);
