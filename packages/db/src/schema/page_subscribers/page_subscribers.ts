import { relations, sql } from "drizzle-orm";
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { page } from "../pages";
import { pageSubscriberToPageComponent } from "./page_subscriber_to_page_component";

export const pageSubscriber = sqliteTable(
  "page_subscriber",
  {
    id: integer("id").primaryKey(),
    email: text("email").notNull(),

    pageId: integer("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),

    // Added: channel type discriminator
    channelType: text("channel_type", {
      enum: ["email", "webhook"],
    })
      .notNull()
      .default("email"),

    // Added: webhook-specific fields (null for email channel)
    webhookUrl: text("webhook_url"),
    channelConfig: text("channel_config"),

    token: text("token"),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (table) => ({
    // Partial unique index: one active email subscription per page
    emailPageActiveIdx: uniqueIndex("idx_page_subscriber_email_page_active")
      .on(sql`LOWER(${table.email})`, table.pageId)
      .where(
        sql`${table.unsubscribedAt} IS NULL AND ${table.channelType} = 'email'`,
      ),

    // Partial unique index: one active webhook subscription per page
    webhookPageActiveIdx: uniqueIndex("idx_page_subscriber_webhook_page_active")
      .on(table.webhookUrl, table.pageId)
      .where(
        sql`${table.unsubscribedAt} IS NULL AND ${table.channelType} = 'webhook'`,
      ),

    // CHECK constraint: only correct identifier populated per channel type
    channelCheck: check(
      "page_subscriber_channel_check",
      sql`(${table.channelType} = 'email' AND ${table.email} IS NOT NULL AND ${table.webhookUrl} IS NULL) OR (${table.channelType} = 'webhook' AND ${table.webhookUrl} IS NOT NULL AND ${table.email} IS NULL)`,
    ),
  }),
);

export const pageSubscriberRelation = relations(
  pageSubscriber,
  ({ one, many }) => ({
    page: one(page, {
      fields: [pageSubscriber.pageId],
      references: [page.id],
    }),
    components: many(pageSubscriberToPageComponent),
  }),
);
