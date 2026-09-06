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
import { workspace } from "../workspaces/workspace";
import { notificationProvider } from "./constants";
import { notification } from "./notification";
import type { NotificationOutboxPayload } from "./validation";

export const notificationOutboxEventType = [
  "alert",
  "recovery",
  "degraded",
] as const;

export const notificationOutboxDeliveryStatus = ["pending", "settled"] as const;

/**
 * How a settled row ended: delivered by the drainer, deliberately skipped, or
 * never ours because the inline sender owned the monitor at write time.
 */
export const notificationOutboxOutcome = [
  "delivered",
  "skipped",
  "inline",
] as const;

export const notificationOutbox = sqliteTable(
  "notification_outbox",
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
    eventType: text("event_type", {
      enum: notificationOutboxEventType,
    }).notNull(),
    fromStatus: text("from_status", { enum: monitorStatus }).notNull(),
    toStatus: text("to_status", { enum: monitorStatus }).notNull(),
    cronTimestamp: integer("cron_timestamp").notNull(),
    incidentId: integer("incident_id").references(() => incidentTable.id, {
      onDelete: "set null",
    }),
    payload: text("payload", { mode: "json" })
      .$type<NotificationOutboxPayload>()
      .notNull(),
    deliveryStatus: text("delivery_status", {
      enum: notificationOutboxDeliveryStatus,
    })
      .default("pending")
      .notNull(),
    outcome: text("outcome", { enum: notificationOutboxOutcome }),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: integer("next_attempt_at").notNull(),
    deadlineAt: integer("deadline_at").notNull(),
    lockedBy: text("locked_by"),
    lockedUntil: integer("locked_until"),
    deliveredAt: integer("delivered_at"),
    lastError: text("last_error"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("notification_outbox_dedup_key_idx").on(t.dedupKey),
    index("notification_outbox_claim_idx")
      .on(t.nextAttemptAt)
      .where(sql`${t.deliveryStatus} = 'pending'`),
    index("notification_outbox_notification_id_cron_timestamp_idx").on(
      t.notificationId,
      t.cronTimestamp,
    ),
    index("notification_outbox_channel_idx")
      .on(t.monitorId, t.notificationId)
      .where(sql`${t.deliveryStatus} = 'pending'`),
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
    eventType: text("event_type", {
      enum: notificationOutboxEventType,
    }).notNull(),
    fromStatus: text("from_status", { enum: monitorStatus }).notNull(),
    toStatus: text("to_status", { enum: monitorStatus }).notNull(),
    cronTimestamp: integer("cron_timestamp").notNull(),
    incidentId: integer("incident_id"),
    payload: text("payload", { mode: "json" })
      .$type<NotificationOutboxPayload>()
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

export const notificationOutboxRelations = relations(
  notificationOutbox,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [notificationOutbox.monitorId],
      references: [monitor.id],
    }),
    notification: one(notification, {
      fields: [notificationOutbox.notificationId],
      references: [notification.id],
    }),
    incident: one(incidentTable, {
      fields: [notificationOutbox.incidentId],
      references: [incidentTable.id],
    }),
  }),
);
