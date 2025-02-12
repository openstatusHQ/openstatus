import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { monitorPeriodicity } from "../constants";
import { maintenancesToMonitors } from "../maintenances";
import { monitorTagsToMonitors } from "../monitor_tags";
import { notificationsToMonitors } from "../notifications";
import { page } from "../pages";
import { monitorsToStatusReport } from "../status_reports";
import { workspace } from "../workspaces/workspace";
import { monitorJobTypes, monitorMethods, monitorStatus } from "./constants";

export const monitor = sqliteTable("monitor", {
  id: integer("id").primaryKey(),
  jobType: text("job_type", { enum: monitorJobTypes })
    .default("http")
    .notNull(),
  periodicity: text("periodicity", { enum: monitorPeriodicity })
    .default("other")
    .notNull(),
  status: text("status", { enum: monitorStatus }).default("active").notNull(),
  active: integer("active", { mode: "boolean" }).default(false),

  regions: text("regions").default("").notNull(),

  url: text("url", { length: 2048 }).notNull(), // URI

  name: text("name", { length: 256 }).default("").notNull(),
  description: text("description").default("").notNull(),

  headers: text("headers").default(""),
  body: text("body").default(""),
  method: text("method", { enum: monitorMethods }).default("GET"),
  workspaceId: integer("workspace_id").references(() => workspace.id),

  // Custom timeout for this monitor
  timeout: integer("timeout").notNull().default(45000), // in milliseconds

  // Threshold for the monitor to be considered degraded
  degradedAfter: integer("degraded_after"), // in millisecond

  assertions: text("assertions"),

  otelEndpoint: text("otel_endpoint"),

  otelHeaders: text("otel_headers"),

  public: integer("public", { mode: "boolean" }).default(false),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),

  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

export const monitorRelation = relations(monitor, ({ one, many }) => ({
  monitorsToPages: many(monitorsToPages),
  monitorsToStatusReports: many(monitorsToStatusReport),
  monitorTagsToMonitors: many(monitorTagsToMonitors),
  workspace: one(workspace, {
    fields: [monitor.workspaceId],
    references: [workspace.id],
  }),
  monitorsToNotifications: many(notificationsToMonitors),
  maintenancesToMonitors: many(maintenancesToMonitors),
}));

export const monitorsToPages = sqliteTable(
  "monitors_to_pages",
  {
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitor.id, { onDelete: "cascade" }),
    pageId: integer("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    order: integer("order").default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.monitorId, t.pageId] }),
  }),
);

export const monitorsToPagesRelation = relations(
  monitorsToPages,
  ({ one }) => ({
    monitor: one(monitor, {
      fields: [monitorsToPages.monitorId],
      references: [monitor.id],
    }),
    page: one(page, {
      fields: [monitorsToPages.pageId],
      references: [page.id],
    }),
  }),
);
