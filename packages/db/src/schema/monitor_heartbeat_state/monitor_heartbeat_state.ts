import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors";

export const heartbeatPingKinds = ["success", "fail"] as const;
export type HeartbeatPingKind = (typeof heartbeatPingKinds)[number];

export const monitorHeartbeatState = sqliteTable(
  "monitor_heartbeat_state",
  {
    monitorId: integer("monitor_id")
      .primaryKey()
      .references(() => monitor.id, { onDelete: "cascade" }),
    lastPingAt: integer("last_ping_at", { mode: "timestamp_ms" }),
    // what the last ping reported: a `/fail` keeps the heartbeat down until a success ping
    lastPingKind: text("last_ping_kind", { enum: heartbeatPingKinds })
      .notNull()
      .default("success"),
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
