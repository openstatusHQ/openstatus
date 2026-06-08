import { db as defaultDb, eq } from "@openstatus/db";
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
  affectedComponentIds?: string[];
  raw: unknown;
};

export type UpsertExternalIncidentsResult = {
  upserted: number;
};

type ExistingRow = {
  id: number;
  providerIncidentId: string;
  name: string;
  status: string;
  impact: string | null;
  shortlink: string | null;
  startedAt: Date | null;
  resolvedAt: Date | null;
  affectedComponentIds: string[];
};

type DesiredRow = {
  providerIncidentId: string;
  name: string;
  status: string;
  impact: string | null;
  shortlink: string | null;
  startedAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
  affectedComponentIds: string[];
  rawPayload: unknown;
};

function nullish<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function datesEqual(a: Date | null, b: Date | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

function incidentsEqual(existing: ExistingRow, desired: DesiredRow): boolean {
  return (
    existing.name === desired.name &&
    existing.status === desired.status &&
    nullish(existing.impact) === nullish(desired.impact) &&
    nullish(existing.shortlink) === nullish(desired.shortlink) &&
    datesEqual(existing.startedAt, desired.startedAt) &&
    datesEqual(existing.resolvedAt, desired.resolvedAt) &&
    arraysEqual(existing.affectedComponentIds, desired.affectedComponentIds)
  );
}

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
      const existing = await tx
        .select({
          id: externalServiceIncident.id,
          providerIncidentId: externalServiceIncident.providerIncidentId,
          name: externalServiceIncident.name,
          status: externalServiceIncident.status,
          impact: externalServiceIncident.impact,
          shortlink: externalServiceIncident.shortlink,
          startedAt: externalServiceIncident.startedAt,
          resolvedAt: externalServiceIncident.resolvedAt,
          affectedComponentIds: externalServiceIncident.affectedComponentIds,
        })
        .from(externalServiceIncident)
        .where(eq(externalServiceIncident.externalServiceId, externalServiceId))
        .all();

      const existingByKey = new Map<string, ExistingRow>(
        existing.map((row) => [row.providerIncidentId, row]),
      );

      const inserts: DesiredRow[] = [];
      const updates: Array<{ id: number; row: DesiredRow }> = [];

      for (const incident of incidents) {
        const desired: DesiredRow = {
          providerIncidentId: incident.providerIncidentId,
          name: incident.name,
          status: incident.status,
          impact: nullish(incident.impact),
          shortlink: nullish(incident.shortlink),
          startedAt: incident.startedAt ?? null,
          createdAt: incident.createdAt,
          resolvedAt: incident.resolvedAt,
          affectedComponentIds: incident.affectedComponentIds ?? [],
          rawPayload: incident.raw,
        };

        const prev = existingByKey.get(incident.providerIncidentId);
        if (!prev) {
          inserts.push(desired);
          continue;
        }
        if (!incidentsEqual(prev, desired)) {
          updates.push({ id: prev.id, row: desired });
        }
      }

      if (inserts.length > 0) {
        await tx
          .insert(externalServiceIncident)
          .values(
            inserts.map((row) => ({
              externalServiceId,
              providerIncidentId: row.providerIncidentId,
              name: row.name,
              status: row.status,
              impact: row.impact,
              shortlink: row.shortlink,
              startedAt: row.startedAt,
              createdAt: row.createdAt,
              resolvedAt: row.resolvedAt,
              affectedComponentIds: row.affectedComponentIds,
              rawPayload: row.rawPayload,
              rawPayloadPurgedAt: null,
              firstSeenAt: now,
              updatedAt: now,
            })),
          )
          .run();
      }

      for (const { id, row } of updates) {
        // rawPayload co-rewrites whenever a scalar field changes — we do not
        // diff the blob, only its scalar siblings. This eliminates the per-tick
        // JSON rewrite on idle incidents.
        await tx
          .update(externalServiceIncident)
          .set({
            name: row.name,
            status: row.status,
            impact: row.impact,
            shortlink: row.shortlink,
            startedAt: row.startedAt,
            resolvedAt: row.resolvedAt,
            affectedComponentIds: row.affectedComponentIds,
            rawPayload: row.rawPayload,
            rawPayloadPurgedAt: null,
            updatedAt: now,
          })
          .where(eq(externalServiceIncident.id, id))
          .run();
      }

      return { upserted: inserts.length + updates.length };
    }),
  );
}
