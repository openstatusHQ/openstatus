import { relations, sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { workspace } from "../workspaces/workspace";
import {
  type IncidentTargetTargets,
  incidentTargetResolutionStops,
  incidentTargetResponseMets,
} from "./constants";

export const incidentResponseTarget = sqliteTable(
  "incident_response_target",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // copied as-is into the incident's snapshot at declare
    targets: text("targets", { mode: "json" })
      .$type<IncidentTargetTargets>()
      .notNull(),
    resolutionStop: text("resolution_stop", {
      enum: incidentTargetResolutionStops,
    })
      .notNull()
      .default("mitigated"),
    responseMet: text("response_met", { enum: incidentTargetResponseMets })
      .notNull()
      .default("acknowledged"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    uniqueIndex("incident_response_target_workspace_id_idx").on(t.workspaceId),
  ],
);

export const incidentResponseTargetRelations = relations(
  incidentResponseTarget,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [incidentResponseTarget.workspaceId],
      references: [workspace.id],
    }),
  }),
);
