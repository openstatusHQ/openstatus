import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";

import { workspace } from "./workspaces";

export const integration = sqliteTable("integration", {
  id: integer("id").primaryKey(),
  name: text("name", { length: 256 }).notNull(), // Should be vercel or other

  workspaceId: integer("workspace_id").references(() => workspace.id),

  // Not used yet but we might need to get store something for the integration  webhook url and or secret
  credential: text("credential", { mode: "json" }),

  externalId: text("external_id").notNull(), // the id of the integration in the external service

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),

  data: text("data", { mode: "json" }).notNull(),
});

export const insertIntegrationSchema = createInsertSchema(integration);
