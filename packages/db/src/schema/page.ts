import { datetime, mysqlTable, serial, varchar } from "drizzle-orm/mysql-core";
import { statusJob } from "./status-job";
import { incident } from "./incident";

export const page = mysqlTable("page", {
  id: serial("id").primaryKey(),

  slug: varchar("slug", { length: 256 }), // which is used for https://slug.openstatus.dev
  customDomain: varchar("custom_domain", { length: 256 }),

  statusJobId: serial("id").references(() => statusJob.id),
  incidentId: serial("id").references(() => incident.id),
  // We should store settings of the page

  createdAt: datetime("created_at").default(new Date()),
  updatedAt: datetime("updated_at"),
});
