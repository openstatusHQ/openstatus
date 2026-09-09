import { relations, sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { workspace } from "../workspaces";
import { alertProviders } from "./constants";
import type { AlertSourceConfig } from "./validation";

export { alertProviders };

export const alertSource = sqliteTable(
  "alert_source",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: alertProviders }).notNull(),
    active: integer("active", { mode: "boolean" }).default(true).notNull(),
    config: text("config", { mode: "json" })
      .$type<AlertSourceConfig>()
      .default(sql`(json_object())`)
      .notNull(),
    lastEventAt: integer("last_event_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    uniqueIndex("alert_source_workspace_id_provider_idx").on(
      t.workspaceId,
      t.provider,
    ),
  ],
);

export const alertSourceRelations = relations(alertSource, ({ one }) => ({
  workspace: one(workspace, {
    fields: [alertSource.workspaceId],
    references: [workspace.id],
  }),
}));
