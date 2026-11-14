import { relations, sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { workspace } from "../workspaces/workspace";
import {
  type IncidentSlaTargets,
  incidentSlaResolutionStops,
  incidentSlaResponseMets,
} from "./constants";

export const incidentSlaPolicy = sqliteTable(
  "incident_sla_policy",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // copied as-is into the incident's snapshot at declare
    targets: text("targets", { mode: "json" })
      .$type<IncidentSlaTargets>()
      .notNull(),
    resolutionStop: text("resolution_stop", {
      enum: incidentSlaResolutionStops,
    })
      .notNull()
      .default("mitigated"),
    responseMet: text("response_met", { enum: incidentSlaResponseMets })
      .notNull()
      .default("acknowledged"),
    // percent of monthly fees per missed target; null: no support credits
    creditPerMissPct: real("credit_per_miss_pct"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    uniqueIndex("incident_sla_policy_workspace_id_idx").on(t.workspaceId),
  ],
);

export const incidentSlaPolicyRelations = relations(
  incidentSlaPolicy,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [incidentSlaPolicy.workspaceId],
      references: [workspace.id],
    }),
  }),
);
