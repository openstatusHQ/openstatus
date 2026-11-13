import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { workspace } from "../workspaces/workspace";
import {
  monitorSlaEpisodeKinds,
  monitorSlaEpisodeTreatments,
} from "./constants";
import { monitorSlaSealedMonth } from "./monitor_sla_sealed_month";

/** An episode behind a sealed month, kept past Tinybird's retention. */
export const monitorSlaSealedEpisode = sqliteTable(
  "monitor_sla_sealed_episode",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    sealedMonthId: integer("sealed_month_id")
      .notNull()
      .references(() => monitorSlaSealedMonth.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: monitorSlaEpisodeKinds }).notNull(),
    // epoch ms, half-open [started_at, ended_at)
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at").notNull(),
    runs: integer("runs").notNull(),
    weightedMs: integer("weighted_ms").notNull(),
    treatment: text("treatment", {
      enum: monitorSlaEpisodeTreatments,
    }).notNull(),
  },
  (t) => [
    index("monitor_sla_sealed_episode_sealed_month_id_idx").on(t.sealedMonthId),
  ],
);

export const monitorSlaSealedEpisodeRelations = relations(
  monitorSlaSealedEpisode,
  ({ one }) => ({
    sealedMonth: one(monitorSlaSealedMonth, {
      fields: [monitorSlaSealedEpisode.sealedMonthId],
      references: [monitorSlaSealedMonth.id],
    }),
  }),
);
