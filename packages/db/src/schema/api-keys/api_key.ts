import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../users";
import { workspace } from "../workspaces";
import type { Scope } from "./constants";

export const apiKey = sqliteTable(
  "api_key",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description"),
    prefix: text("prefix").notNull().unique(),
    hashedToken: text("hashed_token").notNull().unique(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Stored as a JSON array so per-resource scopes (e.g. 'monitor.read')
    // can be added later without re-shaping the column. v1 stores a
    // single value: ['read'] or ['write']. Existing rows backfill to
    // ['write'] via the column default to preserve current behavior.
    scopes: text("scopes", { mode: "json" })
      .$type<Scope[]>()
      .notNull()
      .default(["write"]),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  },
  (table) => [
    index("api_key_prefix_idx").on(table.prefix),
    index("api_key_workspace_id_idx").on(table.workspaceId),
  ],
);
