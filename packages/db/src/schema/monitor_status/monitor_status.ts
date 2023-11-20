import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { monitor, monitorStatus as monitorStatusEnum } from "../monitors";

export const monitorStatusTable = sqliteTable(
  "monitor_status",
  {
    monitorId: integer("monitor_id")
      .references(() => monitor.id, { onDelete: "cascade" })
      .notNull(),
    region: text("region").default("").notNull(),
    status: text("status", { enum: monitorStatusEnum })
      .default("active")
      .notNull(),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (table) => {
    return {
      primaryKey: primaryKey(table.monitorId, table.region),
      monitorIdIdx: index("monitor_id_idx").on(table.monitorId),
      regionIdx: index("region_idx").on(table.region),
    };
  },
);

export const monitorStatusRelations = relations(
  monitorStatusTable,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [monitorStatusTable.monitorId],
      references: [monitor.id],
    }),
  }),
);
