import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm/sql";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { monitor, monitorStatus } from "../monitors";
import { privateLocation } from "./private_locations";

export const privateLocationMonitorStatus = sqliteTable(
  "private_location_monitor_status",
  {
    monitorId: integer("monitor_id")
      .references(() => monitor.id, { onDelete: "cascade" })
      .notNull(),
    privateLocationId: integer("private_location_id")
      .references(() => privateLocation.id, { onDelete: "cascade" })
      .notNull(),
    status: text("status", { enum: monitorStatus }).default("active").notNull(),
    cronTimestamp: integer("cron_timestamp").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (table) => [
    primaryKey({ columns: [table.monitorId, table.privateLocationId] }),
    index("private_location_monitor_status_pl_id_idx").on(
      table.privateLocationId,
    ),
  ],
);

export const privateLocationMonitorStatusRelations = relations(
  privateLocationMonitorStatus,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [privateLocationMonitorStatus.monitorId],
      references: [monitor.id],
    }),
    privateLocation: one(privateLocation, {
      fields: [privateLocationMonitorStatus.privateLocationId],
      references: [privateLocation.id],
    }),
  }),
);
