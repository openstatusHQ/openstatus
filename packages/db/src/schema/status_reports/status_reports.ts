import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { page } from "../pages";
import { workspace } from "../workspaces";

export const statusReportStatus = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;

export const statusReport = sqliteTable("status_report", {
  id: integer("id").primaryKey(),
  status: text("status", { enum: statusReportStatus }).notNull(),
  title: text("title", { length: 256 }).notNull(),

  workspaceId: integer("workspace_id").references(() => workspace.id),

  pageId: integer("page_id").references(() => page.id),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`
  ),

  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`
  ),
});

export const statusReportUpdate = sqliteTable("status_report_update", {
  id: integer("id").primaryKey(),

  status: text("status", statusReportStatus).notNull(),
  date: integer("date", { mode: "timestamp" }).notNull(),
  message: text("message").notNull(),

  statusReportId: integer("status_report_id")
    .references(() => statusReport.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`
  ),
});

export const StatusReportRelations = relations(
  statusReport,
  ({ one, many }) => ({
    statusReportUpdates: many(statusReportUpdate),
    workspace: one(workspace, {
      fields: [statusReport.workspaceId],
      references: [workspace.id],
    }),
    page: one(page, {
      fields: [statusReport.pageId],
      references: [page.id],
    }),
  })
);

export const statusReportUpdateRelations = relations(
  statusReportUpdate,
  ({ one }) => ({
    statusReport: one(statusReport, {
      fields: [statusReportUpdate.statusReportId],
      references: [statusReport.id],
    }),
  })
);
