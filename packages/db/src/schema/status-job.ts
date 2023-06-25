import {
  datetime,
  mysqlEnum,
  mysqlTable,
  int,
  varchar,
  timestamp,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { page } from "./page";

export const statusJob = mysqlTable("statusJob", {
  id: int("id").autoincrement().primaryKey(),
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

  pageId: int("page_id").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updateddAt: timestamp("updated_at").notNull().onUpdateNow(),
});

export const statusJobRelation = relations(statusJob, ({ one }) => ({
  page: one(page, {
    fields: [statusJob.pageId],
    references: [page.id],
  }),
}));
