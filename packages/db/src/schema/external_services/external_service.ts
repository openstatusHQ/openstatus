import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import {
  type ApiConfig,
  type Industry,
  STATUS_PAGE_PROVIDERS,
} from "./constants";

export const externalService = sqliteTable(
  "external_service",
  {
    id: integer("id").primaryKey(),
    slug: text("slug", { length: 64 }).notNull().unique(),
    aliases: text("aliases", { mode: "json" })
      .$type<string[]>()
      .default(sql`(json_array())`)
      .notNull(),
    name: text("name", { length: 256 }).notNull(),
    url: text("url").notNull(),
    statusPageUrl: text("status_page_url").notNull(),
    provider: text("provider", { enum: STATUS_PAGE_PROVIDERS }).notNull(),
    industry: text("industry", { mode: "json" }).$type<Industry[]>().notNull(),
    description: text("description"),
    apiConfig: text("api_config", { mode: "json" }).$type<ApiConfig>(),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [index("external_service_deleted_at_idx").on(t.deletedAt)],
);
