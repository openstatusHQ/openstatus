import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

import { workspace } from "../workspaces/workspace";
import { monitorSlaPolicy } from "./monitor_sla_policy";

/** Target and strictness that apply from `effective_from` until the next row. */
export const monitorSlaPolicyTerms = sqliteTable(
  "monitor_sla_policy_terms",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    monitorSlaPolicyId: integer("monitor_sla_policy_id")
      .notNull()
      .references(() => monitorSlaPolicy.id, { onDelete: "cascade" }),
    // thousandths of a percent, as on the policy
    target: integer("target").notNull(),
    strict: integer("strict", { mode: "boolean" }).notNull(),
    // first of the month in the policy's time zone, YYYY-MM-01
    effectiveFrom: text("effective_from").notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    unique("monitor_sla_policy_terms_policy_effective_from_unique").on(
      t.monitorSlaPolicyId,
      t.effectiveFrom,
    ),
    index("monitor_sla_policy_terms_workspace_id_idx").on(t.workspaceId),
  ],
);

export const monitorSlaPolicyTermsRelations = relations(
  monitorSlaPolicyTerms,
  ({ one }) => ({
    policy: one(monitorSlaPolicy, {
      fields: [monitorSlaPolicyTerms.monitorSlaPolicyId],
      references: [monitorSlaPolicy.id],
    }),
  }),
);
