import { relations, sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";

import { pageComponent } from "../page_components";
import { pageSubscriber } from "./page_subscribers";

export const pageSubscriberToPageComponent = sqliteTable(
  "page_subscriber_to_page_component",
  {
    pageSubscriberId: integer("page_subscriber_id")
      .notNull()
      .references(() => pageSubscriber.id, { onDelete: "cascade" }),
    pageComponentId: integer("page_component_id")
      .notNull()
      .references(() => pageComponent.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pageSubscriberId, t.pageComponentId] }),
  }),
);

export const pageSubscriberToPageComponentRelations = relations(
  pageSubscriberToPageComponent,
  ({ one }) => ({
    pageSubscriber: one(pageSubscriber, {
      fields: [pageSubscriberToPageComponent.pageSubscriberId],
      references: [pageSubscriber.id],
    }),
    pageComponent: one(pageComponent, {
      fields: [pageSubscriberToPageComponent.pageComponentId],
      references: [pageComponent.id],
    }),
  }),
);
