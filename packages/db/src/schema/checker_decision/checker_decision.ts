import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { monitorStatus } from "../monitors/constants";
import { monitor } from "../monitors/monitor";

export const checkerDecision = sqliteTable(
  "checker_decision",
  {
    id: integer("id").primaryKey(),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    region: text("region").notNull(),
    cronTimestamp: integer("cron_timestamp").notNull(),
    fromStatus: text("from_status", { enum: monitorStatus }).notNull(),
    toStatus: text("to_status", { enum: monitorStatus }).notNull(),
    quorumCount: integer("quorum_count").notNull(),
    regionCount: integer("region_count").notNull(),
    transitioned: integer("transitioned", { mode: "boolean" }).notNull(),
    outboxRows: integer("outbox_rows").default(0).notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("checker_decision_monitor_id_cron_timestamp_idx").on(
      t.monitorId,
      t.cronTimestamp,
    ),
    index("checker_decision_created_at_idx").on(t.createdAt),
  ],
);

export const checkerDecisionRelations = relations(
  checkerDecision,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [checkerDecision.monitorId],
      references: [monitor.id],
    }),
  }),
);
