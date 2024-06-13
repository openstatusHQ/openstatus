import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { monitorMethods } from "../monitors/constants";
import { workspace } from "../workspaces";

export const check = sqliteTable("check", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  regions: text("regions").default("").notNull(),
  url: text("url", { length: 4096 }).notNull(),
  headers: text("headers").default(""),
  body: text("body").default(""),
  method: text("method", { enum: monitorMethods }).default("GET"),

  countRequests: integer("count_requests").default(1),

  workspaceId: integer("workspace_id").references(() => workspace.id),

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});
