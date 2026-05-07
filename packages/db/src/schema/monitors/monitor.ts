import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { monitorPeriodicity } from "../constants";
import { incidentTable } from "../incidents/incident";
import { monitorStatusTable } from "../monitor_status/monitor_status";
import { monitorTagsToMonitors } from "../monitor_tags";
import { notificationsToMonitors } from "../notifications";
import { privateLocationToMonitors } from "../private_locations";
import { workspace } from "../workspaces/workspace";
import { monitorJobTypes, monitorMethods, monitorStatus } from "./constants";

export const monitor = sqliteTable(
  "monitor",
  {
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
    externalName: text("external_name"),
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

    retry: integer("retry").default(3),

    followRedirects: integer("follow_redirects", { mode: "boolean" }).default(
      true,
    ),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),

    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (t) => [
    index("monitor_workspace_id_active_idx")
      .on(t.workspaceId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const monitorRelation = relations(monitor, ({ one, many }) => ({
  monitorTagsToMonitors: many(monitorTagsToMonitors),
  workspace: one(workspace, {
    fields: [monitor.workspaceId],
    references: [workspace.id],
  }),
  monitorsToNotifications: many(notificationsToMonitors),
  incidents: many(incidentTable),
  monitorStatus: many(monitorStatusTable),
  privateLocationToMonitors: many(privateLocationToMonitors),
}));
