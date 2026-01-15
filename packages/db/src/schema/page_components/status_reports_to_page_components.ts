import { relations, sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";

import { statusReport } from "../status_reports";
import { pageComponent } from "./page_components";

export const statusReportsToPageComponents = sqliteTable(
  "status_report_to_page_component",
  {
    statusReportId: integer("status_report_id")
      .notNull()
      .references(() => statusReport.id, { onDelete: "cascade" }),
    pageComponentId: integer("page_component_id")
      .notNull()
      .references(() => pageComponent.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.statusReportId, t.pageComponentId] }),
  }),
);

export const statusReportsToPageComponentsRelations = relations(
  statusReportsToPageComponents,
  ({ one }) => ({
    statusReport: one(statusReport, {
      fields: [statusReportsToPageComponents.statusReportId],
      references: [statusReport.id],
    }),
    pageComponent: one(pageComponent, {
      fields: [statusReportsToPageComponents.pageComponentId],
      references: [pageComponent.id],
    }),
  }),
);
