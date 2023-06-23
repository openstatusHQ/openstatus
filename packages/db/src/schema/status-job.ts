import {
  datetime,
  mysqlEnum,
  mysqlTable,
  serial,
  varchar,
} from "drizzle-orm/mysql-core";

export const statusJob = mysqlTable("statusJob", {
  id: serial("id").primaryKey(),
  jobType: mysqlEnum("job_type", ["website", "cron", "other"])
    .notNull()
    .default("other"),
  periodicity: mysqlEnum("periodicity", [
    "every-5-min",
    "every-1-min",
    "every-1-h",
    "other",
  ])
    .notNull()
    .default("other"),
  status: mysqlEnum("status", ["active", "inactive"])
    .notNull()
    .default("inactive"),

  url: varchar("url", { length: 512 }),

  createdAt: datetime("created_at").default(new Date()),
  updatedAt: datetime("updated_at"),
});
