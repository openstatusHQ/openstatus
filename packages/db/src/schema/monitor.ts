import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { monitorsToIncidents } from "./incident";
import { notificationsToMonitors } from "./notification";
import { page } from "./page";
import { workspace } from "./workspace";

export const availableRegions = [
  "auto", // randomly choose region
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "fra1",
  "gru1",
  "hkg1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
] as const;

export const periodicity = ["1m", "5m", "10m", "30m", "1h", "other"] as const;
export const METHODS = ["GET", "POST"] as const;
export const status = ["active", "error"] as const;
export const RegionEnum = z.enum(availableRegions);

export const monitor = sqliteTable("monitor", {
  id: integer("id").primaryKey(),
  jobType: text("job_type", ["website", "cron", "other"])
    .default("other")
    .notNull(),
  periodicity: text("periodicity", ["1m", "5m", "10m", "30m", "1h", "other"])
    .default("other")
    .notNull(),
  status: text("status", status).default("active").notNull(),
  active: integer("active", { mode: "boolean" }).default(false),

  regions: text("regions").default("").notNull(),

  url: text("url", { length: 512 }).notNull(),

  name: text("name", { length: 256 }).default("").notNull(),
  description: text("description").default("").notNull(),

  headers: text("headers").default(""),
  body: text("body").default(""),
  method: text("method", METHODS).default("GET"),
  workspaceId: integer("workspace_id").references(() => workspace.id),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const monitorRelation = relations(monitor, ({ one, many }) => ({
  monitorsToPages: many(monitorsToPages),
  monitorsToIncidents: many(monitorsToIncidents),
  workspace: one(workspace, {
    fields: [monitor.workspaceId],
    references: [workspace.id],
  }),
  monitorsToNotifications: many(notificationsToMonitors),
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
  },
  (t) => ({
    pk: primaryKey(t.monitorId, t.pageId),
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

export const periodicityEnum = z.enum(periodicity);
// Schema for inserting a Monitor - can be used to validate API requests
export const insertMonitorSchema = createInsertSchema(monitor, {
  periodicity: periodicityEnum,
  url: z.string().url(),
  status: z.enum(status).default("active"),
  active: z.boolean().default(false),
  regions: z.array(RegionEnum).default([]).optional(),
  method: z.enum(METHODS).default("GET"),
  body: z.string().default("").optional(),
  headers: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .default([]),
});

export const basicMonitorSchema = createSelectSchema(monitor);

// Schema for selecting a Monitor - can be used to validate API responses
export const selectMonitorSchema = createSelectSchema(monitor, {
  periodicity: periodicityEnum,
  status: z.enum(status).default("active"),
  jobType: z.enum(["website", "cron", "other"]).default("other"),
  active: z.boolean().default(false),
  regions: z
    .preprocess((val) => {
      if (String(val).length > 0) {
        return String(val).split(",");
      } else {
        return [];
      }
    }, z.array(RegionEnum))
    .default([]),
  method: z.enum(METHODS).default("GET"),
});

export const selectMonitorExtendedSchema = selectMonitorSchema.extend({
  method: z.enum(METHODS).default("GET"),
  body: z
    .preprocess((val) => {
      return String(val);
    }, z.string())
    .default(""),
  headers: z.preprocess(
    (val) => {
      if (String(val).length > 0) {
        return JSON.parse(String(val));
      } else {
        return [];
      }
    },
    z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  ),
});

export const allMonitorsExtendedSchema = z.array(selectMonitorExtendedSchema);
export type ExtendedMonitor = z.infer<typeof selectMonitorExtendedSchema>;
export type ExtendedMonitors = z.infer<typeof allMonitorsExtendedSchema>;
