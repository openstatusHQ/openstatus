import { relations } from "drizzle-orm";
import { index, integer, sqliteTable } from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";

export const monitorHeartbeatState = sqliteTable(
  "monitor_heartbeat_state",
  {
    monitorId: integer("monitor_id")
      .primaryKey()
      .references(() => monitor.id, { onDelete: "cascade" }),
    lastPingAt: integer("last_ping_at", { mode: "timestamp_ms" }),
    // NULL until the first ping, so a new heartbeat never alerts
    nextDueAt: integer("next_due_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("monitor_heartbeat_state_next_due_at_idx").on(t.nextDueAt)],
);

export const monitorHeartbeatStateRelations = relations(
  monitorHeartbeatState,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [monitorHeartbeatState.monitorId],
      references: [monitor.id],
    }),
  }),
);
