import { sql } from "drizzle-orm";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

import { monitor } from "../monitors/monitor";
import { workspace } from "../workspaces/workspace";

/** The range the monitor's stored episodes are authoritative for: [sealed_from, sealed_until) in epoch ms. */
export const monitorUptimeWatermark = sqliteTable("monitor_uptime_watermark", {
  monitorId: integer("monitor_id")
    .primaryKey()
    .references(() => monitor.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  sealedFrom: integer("sealed_from").notNull(),
  sealedUntil: integer("sealed_until").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});
