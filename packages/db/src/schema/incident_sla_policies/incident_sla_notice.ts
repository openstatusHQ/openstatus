import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { incident } from "../incidents/incident";

export const incidentSlaNoticeKinds = [
  "response",
  "resolution",
  "update",
] as const;
export type IncidentSlaNoticeKind = (typeof incidentSlaNoticeKinds)[number];
export const incidentSlaNoticeTypes = ["warning", "miss"] as const;
export type IncidentSlaNoticeType = (typeof incidentSlaNoticeTypes)[number];
export const incidentSlaNoticeChannels = ["slack", "email"] as const;
export type IncidentSlaNoticeChannel =
  (typeof incidentSlaNoticeChannels)[number];

// One row per notice and channel, written before sending: the insert that wins
// the unique index is the only one that delivers, on any number of machines.
export const incidentSlaNotice = sqliteTable(
  "incident_sla_notice",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incident.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: incidentSlaNoticeKinds }).notNull(),
    notice: text("notice", { enum: incidentSlaNoticeTypes }).notNull(),
    dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
    channel: text("channel", { enum: incidentSlaNoticeChannels }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    uniqueIndex("incident_sla_notice_unique_idx").on(
      t.incidentId,
      t.kind,
      t.notice,
      t.dueAt,
      t.channel,
    ),
  ],
);
