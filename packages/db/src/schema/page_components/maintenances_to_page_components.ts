import { relations, sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";

import { maintenance } from "../maintenances";
import { pageComponent } from "./page_components";

export const maintenancesToPageComponents = sqliteTable(
  "maintenance_to_page_component",
  {
    maintenanceId: integer("maintenance_id")
      .notNull()
      .references(() => maintenance.id, { onDelete: "cascade" }),
    pageComponentId: integer("page_component_id")
      .notNull()
      .references(() => pageComponent.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.maintenanceId, t.pageComponentId] }),
  }),
);

export const maintenancesToPageComponentsRelations = relations(
  maintenancesToPageComponents,
  ({ one }) => ({
    maintenance: one(maintenance, {
      fields: [maintenancesToPageComponents.maintenanceId],
      references: [maintenance.id],
    }),
    pageComponent: one(pageComponent, {
      fields: [maintenancesToPageComponents.pageComponentId],
      references: [pageComponent.id],
    }),
  }),
);
