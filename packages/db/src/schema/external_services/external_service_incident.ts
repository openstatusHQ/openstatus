import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { externalService } from "./external_service";

export type IncidentRawPayload =
  | string
  | number
  | boolean
  | null
  | { [key: string]: IncidentRawPayload }
  | IncidentRawPayload[];

export const externalServiceIncident = sqliteTable(
  "external_service_incident",
  {
    id: integer("id").primaryKey(),
    externalServiceId: integer("external_service_id")
      .notNull()
      .references(() => externalService.id),
    providerIncidentId: text("provider_incident_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    impact: text("impact"),
    shortlink: text("shortlink"),
    startedAt: integer("started_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    rawPayload: text("raw_payload", {
      mode: "json",
    }).$type<IncidentRawPayload>(),
    rawPayloadPurgedAt: integer("raw_payload_purged_at", { mode: "timestamp" }),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(strftime('%s', 'now'))`),
  },
  (t) => [
    uniqueIndex("external_service_incident_unique_idx").on(
      t.externalServiceId,
      t.providerIncidentId,
    ),
    index("external_service_incident_started_at_idx").on(
      t.externalServiceId,
      t.startedAt,
    ),
    index("external_service_incident_resolved_at_idx").on(t.resolvedAt),
  ],
);
