import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { incident } from "../incidents/incident";

export const incidentTargetNoticeKinds = ["response", "resolution"] as const;
export type IncidentTargetNoticeKind =
  (typeof incidentTargetNoticeKinds)[number];
export const incidentTargetNoticeTypes = ["warning", "miss"] as const;
export type IncidentTargetNoticeType =
  (typeof incidentTargetNoticeTypes)[number];
export const incidentTargetNoticeChannels = ["slack", "email"] as const;
export type IncidentTargetNoticeChannel =
  (typeof incidentTargetNoticeChannels)[number];

// One row per notice and channel, written before sending: the insert that wins
// the unique index is the only one that delivers, on any number of machines.
export const incidentTargetNotice = sqliteTable(
  "incident_target_notice",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incident.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: incidentTargetNoticeKinds }).notNull(),
    notice: text("notice", { enum: incidentTargetNoticeTypes }).notNull(),
    dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
    channel: text("channel", { enum: incidentTargetNoticeChannels }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    uniqueIndex("incident_target_notice_unique_idx").on(
      t.incidentId,
      t.kind,
      t.notice,
      t.dueAt,
      t.channel,
    ),
  ],
);
