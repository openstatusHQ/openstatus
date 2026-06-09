import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { externalService } from "./external_service";
import { externalServiceComponent } from "./external_service_component";

export const externalServiceReport = sqliteTable(
  "external_service_report",
  {
    id: integer("id").primaryKey(),
    externalServiceId: integer("external_service_id")
      .notNull()
      .references(() => externalService.id),
    externalServiceComponentId: integer(
      "external_service_component_id",
    ).references(() => externalServiceComponent.id),
    reporterHash: text("reporter_hash").notNull(),
    country: text("country").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    index("external_service_report_service_idx").on(
      t.externalServiceId,
      t.createdAt,
    ),
    index("external_service_report_component_idx").on(
      t.externalServiceComponentId,
      t.createdAt,
    ),
  ],
);
