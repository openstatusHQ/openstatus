import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { page } from "../pages";
import { user } from "../users";
import { workspace } from "../workspaces";
import { statusReportStatus } from "./constants";

export { statusReportStatus };

export const statusReport = sqliteTable(
  "status_report",
  {
    id: integer("id").primaryKey(),
    status: text("status", { enum: statusReportStatus }).notNull(),
    title: text("title", { length: 256 }).notNull(),

    workspaceId: integer("workspace_id").references(() => workspace.id),

    pageId: integer("page_id").references(() => page.id, {
      onDelete: "cascade",
    }),

    createdBy: integer("created_by").references(() => user.id),
    updatedBy: integer("updated_by").references(() => user.id),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    index("status_report_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("status_report_page_id_idx").on(t.pageId),
  ],
);

export const statusReportUpdate = sqliteTable(
  "status_report_update",
  {
    id: integer("id").primaryKey(),

    status: text("status", { enum: statusReportStatus }).notNull(),
    date: integer("date", { mode: "timestamp" }).notNull(),
    message: text("message").notNull(),

    statusReportId: integer("status_report_id")
      .references(() => statusReport.id, { onDelete: "cascade" })
      .notNull(),

    createdBy: integer("created_by").references(() => user.id),
    updatedBy: integer("updated_by").references(() => user.id),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    index("status_report_update_status_report_id_idx").on(t.statusReportId),
  ],
);
