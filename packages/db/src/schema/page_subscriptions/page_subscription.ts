import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { page } from "../pages";
import { workspace } from "../workspaces";
import { channelTypes } from "./constants";
import { pageSubscriptionToPageComponent } from "./page_subscription_to_page_component";

export const pageSubscription = sqliteTable(
  "page_subscription",
  {
    id: integer("id").primaryKey(),

    // Scope
    pageId: integer("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),

    // Channel type discriminator (Phase 1: email and webhook only)
    channelType: text("channel_type", {
      enum: channelTypes,
    }).notNull(),

    // Separate identifier columns (only ONE populated based on channelType)
    email: text("email"), // For email channel (normalized to lowercase)
    webhookUrl: text("webhook_url"), // For webhook channel

    // Channel config (JSON for webhook headers, secrets, etc.)
    channelConfig: text("channel_config"), // JSON string, optional

    // Verification & status
    token: text("token").notNull().unique(),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp" }),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (table) => ({
    // Indexes
    pageIdIdx: index("idx_page_subscription_page_id").on(table.pageId),
    workspaceIdIdx: index("idx_page_subscription_workspace_id").on(
      table.workspaceId,
    ),
    verifiedIdx: index("idx_page_subscription_verified").on(table.verifiedAt),
    unsubscribedIdx: index("idx_page_subscription_unsubscribed").on(
      table.unsubscribedAt,
    ),

    // Channel-specific UNIQUE constraints
    // Email: unique per (email, page_id) for active subscriptions
    // Using LOWER() for case-insensitive email matching
    emailPageActiveIdx: uniqueIndex("idx_page_subscription_email_page_active")
      .on(sql`LOWER(${table.email})`, table.pageId)
      .where(
        sql`${table.unsubscribedAt} IS NULL AND ${table.channelType} = 'email'`,
      ),

    // Webhook: unique per (webhook_url, page_id) for active subscriptions
    webhookPageActiveIdx: uniqueIndex(
      "idx_page_subscription_webhook_page_active",
    )
      .on(table.webhookUrl, table.pageId)
      .where(
        sql`${table.unsubscribedAt} IS NULL AND ${table.channelType} = 'webhook'`,
      ),

    // CHECK constraint: only correct identifier populated
    // This enforces database-level validation that:
    // 1. If email channel → email must be populated, webhook_url must be NULL
    // 2. If webhook channel → webhook_url must be populated, email must be NULL
    channelCheck: check(
      "page_subscription_channel_check",
      sql`(${table.channelType} = 'email' AND ${table.email} IS NOT NULL AND ${table.webhookUrl} IS NULL) OR (${table.channelType} = 'webhook' AND ${table.webhookUrl} IS NOT NULL AND ${table.email} IS NULL)`,
    ),
  }),
);

export const pageSubscriptionRelations = relations(
  pageSubscription,
  ({ one, many }) => ({
    page: one(page, {
      fields: [pageSubscription.pageId],
      references: [page.id],
    }),
    workspace: one(workspace, {
      fields: [pageSubscription.workspaceId],
      references: [workspace.id],
    }),
    components: many(pageSubscriptionToPageComponent),
  }),
);
