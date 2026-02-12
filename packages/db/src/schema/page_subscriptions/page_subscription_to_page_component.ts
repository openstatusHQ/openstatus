import { relations, sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";

import { pageComponent } from "../page_components";
import { pageSubscription } from "./page_subscription";

export const pageSubscriptionToPageComponent = sqliteTable(
  "page_subscription_to_page_component",
  {
    pageSubscriptionId: integer("page_subscription_id")
      .notNull()
      .references(() => pageSubscription.id, { onDelete: "cascade" }),
    pageComponentId: integer("page_component_id")
      .notNull()
      .references(() => pageComponent.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.pageSubscriptionId, t.pageComponentId] }),
  }),
);

export const pageSubscriptionToPageComponentRelations = relations(
  pageSubscriptionToPageComponent,
  ({ one }) => ({
    pageSubscription: one(pageSubscription, {
      fields: [pageSubscriptionToPageComponent.pageSubscriptionId],
      references: [pageSubscription.id],
    }),
    pageComponent: one(pageComponent, {
      fields: [pageSubscriptionToPageComponent.pageComponentId],
      references: [pageComponent.id],
    }),
  }),
);
