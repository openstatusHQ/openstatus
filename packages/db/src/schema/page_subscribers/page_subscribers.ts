import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { page } from "../pages";

export const pageSubscriber = sqliteTable("page_subscriber", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),

  pageId: integer("page_id")
    .notNull()
    .references(() => page.id),

  token: text("token"),
  acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const pageSubscriberRelation = relations(pageSubscriber, ({ one }) => ({
  page: one(page, {
    fields: [pageSubscriber.pageId],
    references: [page.id],
  }),
}));
