import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { statusReport } from "../status_reports/status_reports";

export const statusReportSubscriber = sqliteTable("status_report_subscriber", {
  id: integer("id").primaryKey(),
  email: text("email").notNull(),

  statusReportId: integer("status_report_id").references(() => statusReport.id),

  validatedAt: integer("validated_at", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const statusReportSubscriberRelation = relations(
  statusReportSubscriber,
  ({ one }) => ({
    statusReport: one(statusReport, {
      fields: [statusReportSubscriber.statusReportId],
      references: [statusReport.id],
    }),
  }),
);
