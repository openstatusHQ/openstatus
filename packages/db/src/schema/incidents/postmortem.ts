import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../users";
import { postmortemAuthor, postmortemStatus } from "./constants";
import { incident } from "./incident";

export const incidentPostmortem = sqliteTable("incident_postmortem", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  incidentId: integer("incident_id")
    .notNull()
    .unique()
    .references(() => incident.id, { onDelete: "cascade" }),
  status: text("status", { enum: postmortemStatus }).notNull().default("draft"),
  content: text("content").notNull(),
  sourceTranscript: text("source_transcript"),
  draftedBy: text("drafted_by", { enum: postmortemAuthor }).notNull(),
  createdBy: integer("created_by").references(() => user.id),
  updatedBy: integer("updated_by").references(() => user.id),
  approvedBy: integer("approved_by").references(() => user.id),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});

export const incidentPostmortemRelations = relations(
  incidentPostmortem,
  ({ one }) => ({
    incident: one(incident, {
      fields: [incidentPostmortem.incidentId],
      references: [incident.id],
    }),
    approvedByUser: one(user, {
      fields: [incidentPostmortem.approvedBy],
      references: [user.id],
    }),
  }),
);
