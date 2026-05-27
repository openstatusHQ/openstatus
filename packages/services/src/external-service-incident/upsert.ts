import { db as defaultDb } from "@openstatus/db";
import {
  type IncidentRawPayload,
  externalServiceIncident,
} from "@openstatus/db/src/schema";

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
  raw: IncidentRawPayload;
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

  return withBusyRetry(() =>
    db.transaction(async (tx) => {
      for (const incident of incidents) {
        await tx
          .insert(externalServiceIncident)
          .values({
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
          })
          .onConflictDoUpdate({
            target: [
              externalServiceIncident.externalServiceId,
              externalServiceIncident.providerIncidentId,
            ],
            set: {
              name: incident.name,
              status: incident.status,
              impact: incident.impact,
              shortlink: incident.shortlink,
              resolvedAt: incident.resolvedAt,
              rawPayload: incident.raw,
              rawPayloadPurgedAt: null,
              lastSeenAt: now,
              updatedAt: now,
            },
          })
          .run();
      }
      return { upserted: incidents.length };
    }),
  );
}
