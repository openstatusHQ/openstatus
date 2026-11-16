import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors/monitor";
import { workspace } from "../workspaces/workspace";
import { monitorUptimeEpisodeKinds } from "./constants";

/** A monitor's checks as episodes, kept past Tinybird's retention; they tile its watermark range. */
export const monitorUptimeEpisode = sqliteTable(
  "monitor_uptime_episode",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: monitorUptimeEpisodeKinds }).notNull(),
    // epoch ms, half-open [started_at, ended_at)
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at").notNull(),
  },
  (t) => [
    index("monitor_uptime_episode_monitor_id_started_at_idx").on(
      t.monitorId,
      t.startedAt,
    ),
  ],
);
