import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const serviceKind = ["monitoring", "external", "internal"] as const;

export const serviceTable = sqliteTable("service", {
  id: integer("id").primaryKey(),
  name: text("name").default("").notNull(),
  kind: text("kind", { enum: serviceKind }).notNull(),

  // MonitorId  might be null if the service is not monitoring
  monitorId: integer("monitor_id"),
});
