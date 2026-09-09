import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { alertSource } from "../alert_sources";
import { incidentTable } from "../incidents/incident";
import { alertInboxOutcome, alertInboxProcessingStatus } from "./constants";

export { alertInboxOutcome, alertInboxProcessingStatus };

export const alertInbox = sqliteTable(
  "alert_inbox",
  {
    id: integer("id").primaryKey(),
    alertSourceId: integer("alert_source_id")
      .notNull()
      .references(() => alertSource.id, { onDelete: "cascade" }),
    dedupKey: text("dedup_key").notNull(),
    rawBody: text("raw_body").notNull(),
    contentType: text("content_type"),
    externalId: text("external_id"),
    fingerprint: text("fingerprint"),
    processingStatus: text("processing_status", {
      enum: alertInboxProcessingStatus,
    })
      .default("pending")
      .notNull(),
    outcome: text("outcome", { enum: alertInboxOutcome }),
    incidentId: integer("incident_id").references(() => incidentTable.id, {
      onDelete: "set null",
    }),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: integer("next_attempt_at").notNull(),
    deadlineAt: integer("deadline_at").notNull(),
    lockedBy: text("locked_by"),
    lockedUntil: integer("locked_until"),
    processedAt: integer("processed_at"),
    lastError: text("last_error"),
    receivedAt: integer("received_at").notNull(),
  },
  (t) => [
    uniqueIndex("alert_inbox_dedup_key_idx").on(t.dedupKey),
    index("alert_inbox_claim_idx")
      .on(t.nextAttemptAt)
      .where(sql`${t.processingStatus} = 'pending'`),
    // Serialises processing per source-group so a resolved webhook can never
    // overtake the firing it closes.
    index("alert_inbox_ordering_idx")
      .on(t.alertSourceId, t.fingerprint)
      .where(sql`${t.processingStatus} = 'pending'`),
    index("alert_inbox_retention_idx").on(t.processingStatus, t.receivedAt),
  ],
);

export const alertDeadLetter = sqliteTable(
  "alert_dead_letter",
  {
    id: integer("id").primaryKey(),
    inboxId: integer("inbox_id").notNull(),
    alertSourceId: integer("alert_source_id")
      .notNull()
      .references(() => alertSource.id, { onDelete: "cascade" }),
    dedupKey: text("dedup_key").notNull(),
    rawBody: text("raw_body").notNull(),
    contentType: text("content_type"),
    externalId: text("external_id"),
    fingerprint: text("fingerprint"),
    attempts: integer("attempts").notNull(),
    finalError: text("final_error"),
    receivedAt: integer("received_at").notNull(),
    diedAt: integer("died_at").notNull(),
  },
  (t) => [
    uniqueIndex("alert_dead_letter_dedup_key_idx").on(t.dedupKey),
    index("alert_dead_letter_source_died_at_idx").on(t.alertSourceId, t.diedAt),
  ],
);

export const alertInboxRelations = relations(alertInbox, ({ one }) => ({
  alertSource: one(alertSource, {
    fields: [alertInbox.alertSourceId],
    references: [alertSource.id],
  }),
  incident: one(incidentTable, {
    fields: [alertInbox.incidentId],
    references: [incidentTable.id],
  }),
}));
