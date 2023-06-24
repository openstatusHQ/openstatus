import { datetime, mysqlTable, varchar, int } from "drizzle-orm/mysql-core";

export const page = mysqlTable("page", {
  id: int("id").autoincrement().primaryKey(),

  slug: varchar("slug", { length: 256 }), // which is used for https://slug.openstatus.dev
  customDomain: varchar("custom_domain", { length: 256 }),

  statusJobId: int("status_job_id"),
  incidentId: int("incident_id"),
  // We should store settings of the page

  createdAt: datetime("created_at").notNull(),
  updatedAt: datetime("updated_at").notNull(),
});
