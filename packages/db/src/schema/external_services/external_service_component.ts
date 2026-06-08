import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { externalService } from "./external_service";

export const externalServiceComponent = sqliteTable(
  "external_service_component",
  {
    id: integer("id").primaryKey(),
    externalServiceId: integer("external_service_id")
      .notNull()
      .references(() => externalService.id),
    upstreamComponentId: text("upstream_component_id").notNull(),
    slug: text("slug").notNull(),
    aliases: text("aliases", { mode: "json" })
      .$type<string[]>()
      .default(sql`(json_array())`)
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    groupName: text("group_name"),
    position: integer("position").notNull().default(0),
    indicator: text("indicator").notNull(),
    status: text("status").notNull(),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    uniqueIndex("external_service_component_unique_idx").on(
      t.externalServiceId,
      t.upstreamComponentId,
    ),
    uniqueIndex("external_service_component_slug_unique_idx").on(
      t.externalServiceId,
      t.slug,
    ),
  ],
);
