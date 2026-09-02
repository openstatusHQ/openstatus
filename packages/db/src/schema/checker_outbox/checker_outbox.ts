import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { incidentTable } from "../incidents/incident";
import { monitorStatus } from "../monitors/constants";
import { monitor } from "../monitors/monitor";
import { notificationProvider } from "../notifications/constants";
import { notification } from "../notifications/notification";
import { workspace } from "../workspaces/workspace";
import type { CheckerOutboxPayload } from "./validation";

export const checkerOutboxEventType = [
  "alert",
  "recovery",
  "degraded",
] as const;

export const checkerOutboxStatus = ["pending", "done"] as const;

export const checkerOutbox = sqliteTable(
  "checker_outbox",
  {
    id: integer("id").primaryKey(),
    dedupKey: text("dedup_key").notNull(),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id").references(() => workspace.id),
    notificationId: integer("notification_id")
      .notNull()
      .references(() => notification.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: notificationProvider }).notNull(),
    eventType: text("event_type", { enum: checkerOutboxEventType }).notNull(),
    fromStatus: text("from_status", { enum: monitorStatus }).notNull(),
    toStatus: text("to_status", { enum: monitorStatus }).notNull(),
    cronTimestamp: integer("cron_timestamp").notNull(),
    incidentId: integer("incident_id").references(() => incidentTable.id, {
      onDelete: "set null",
    }),
    payload: text("payload", { mode: "json" })
      .$type<CheckerOutboxPayload>()
      .notNull(),
    status: text("status", { enum: checkerOutboxStatus })
      .default("pending")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: integer("available_at").notNull(),
    deadlineAt: integer("deadline_at").notNull(),
    lockedBy: text("locked_by"),
    lockedUntil: integer("locked_until"),
    deliveredAt: integer("delivered_at"),
    lastError: text("last_error"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("checker_outbox_dedup_key_idx").on(t.dedupKey),
    index("checker_outbox_claim_idx")
      .on(t.availableAt)
      .where(sql`${t.status} = 'pending'`),
    index("checker_outbox_notification_id_cron_timestamp_idx").on(
      t.notificationId,
      t.cronTimestamp,
    ),
    index("checker_outbox_channel_idx")
      .on(t.monitorId, t.notificationId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export const notificationDeadLetter = sqliteTable(
  "notification_dead_letter",
  {
    id: integer("id").primaryKey(),
    outboxId: integer("outbox_id").notNull(),
    dedupKey: text("dedup_key").notNull(),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id").references(() => workspace.id),
    notificationId: integer("notification_id").notNull(),
    provider: text("provider", { enum: notificationProvider }).notNull(),
    eventType: text("event_type", { enum: checkerOutboxEventType }).notNull(),
    fromStatus: text("from_status", { enum: monitorStatus }).notNull(),
    toStatus: text("to_status", { enum: monitorStatus }).notNull(),
    cronTimestamp: integer("cron_timestamp").notNull(),
    incidentId: integer("incident_id"),
    payload: text("payload", { mode: "json" })
      .$type<CheckerOutboxPayload>()
      .notNull(),
    attempts: integer("attempts").notNull(),
    finalError: text("final_error"),
    diedAt: integer("died_at").notNull(),
  },
  (t) => [
    uniqueIndex("notification_dead_letter_dedup_key_idx").on(t.dedupKey),
    index("notification_dead_letter_workspace_id_died_at_idx").on(
      t.workspaceId,
      t.diedAt,
    ),
  ],
);

export const checkerOutboxRelations = relations(checkerOutbox, ({ one }) => ({
  monitor: one(monitor, {
    fields: [checkerOutbox.monitorId],
    references: [monitor.id],
  }),
  notification: one(notification, {
    fields: [checkerOutbox.notificationId],
    references: [notification.id],
  }),
  incident: one(incidentTable, {
    fields: [checkerOutbox.incidentId],
    references: [incidentTable.id],
  }),
}));
