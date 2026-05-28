import { db as defaultDb, sql } from "@openstatus/db";
import { externalServiceIncident } from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { withBusyRetry } from "../retry";

export type UpsertExternalIncidentInput = {
  providerIncidentId: string;
  name: string;
  status: string;
  impact?: string;
  shortlink?: string;
  startedAt?: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  raw: unknown;
};

export type UpsertExternalIncidentsResult = {
  upserted: number;
};

export async function upsertExternalIncidentsForService(args: {
  ctx?: { db?: DB };
  externalServiceId: number;
  incidents: UpsertExternalIncidentInput[];
  now?: Date;
}): Promise<UpsertExternalIncidentsResult> {
  const { ctx, externalServiceId, incidents } = args;
  if (incidents.length === 0) return { upserted: 0 };

  const now = args.now ?? new Date();
  const db = ctx?.db ?? defaultDb;

  const values = incidents.map((incident) => ({
    externalServiceId,
    providerIncidentId: incident.providerIncidentId,
    name: incident.name,
    status: incident.status,
    impact: incident.impact,
    shortlink: incident.shortlink,
    startedAt: incident.startedAt,
    createdAt: incident.createdAt,
    resolvedAt: incident.resolvedAt,
    rawPayload: incident.raw,
    rawPayloadPurgedAt: null,
    firstSeenAt: now,
    lastSeenAt: now,
    updatedAt: now,
  }));

  return withBusyRetry(() =>
    db.transaction(async (tx) => {
      await tx
        .insert(externalServiceIncident)
        .values(values)
        .onConflictDoUpdate({
          target: [
            externalServiceIncident.externalServiceId,
            externalServiceIncident.providerIncidentId,
          ],
          set: {
            name: sql`excluded.name`,
            status: sql`excluded.status`,
            impact: sql`excluded.impact`,
            shortlink: sql`excluded.shortlink`,
            startedAt: sql`excluded.started_at`,
            resolvedAt: sql`excluded.resolved_at`,
            rawPayload: sql`excluded.raw_payload`,
            rawPayloadPurgedAt: null,
            lastSeenAt: now,
            updatedAt: now,
          },
        })
        .run();
      return { upserted: values.length };
    }),
  );
}
