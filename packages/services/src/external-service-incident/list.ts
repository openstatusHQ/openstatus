import { and, db as defaultDb, desc, eq, sql } from "@openstatus/db";
import { externalServiceIncident } from "@openstatus/db/src/schema";

import { getExternalServiceBySlug } from "../external-service";
import type { GlobalReadContext } from "../external-service/internal";

export type ExternalIncidentListItem = {
  id: number;
  externalServiceId: number;
  providerIncidentId: string;
  name: string;
  status: string;
  impact: string | null;
  shortlink: string | null;
  startedAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

const DEFAULT_LIMIT = 5;

export async function listExternalIncidentsByServiceId(args: {
  ctx?: GlobalReadContext;
  externalServiceId: number;
  limit?: number;
}): Promise<ExternalIncidentListItem[]> {
  const { ctx, externalServiceId } = args;
  const db = ctx?.db ?? defaultDb;
  const limit = args.limit ?? DEFAULT_LIMIT;

  const rows = await db
    .select({
      id: externalServiceIncident.id,
      externalServiceId: externalServiceIncident.externalServiceId,
      providerIncidentId: externalServiceIncident.providerIncidentId,
      name: externalServiceIncident.name,
      status: externalServiceIncident.status,
      impact: externalServiceIncident.impact,
      shortlink: externalServiceIncident.shortlink,
      startedAt: externalServiceIncident.startedAt,
      createdAt: externalServiceIncident.createdAt,
      resolvedAt: externalServiceIncident.resolvedAt,
      firstSeenAt: externalServiceIncident.firstSeenAt,
      lastSeenAt: externalServiceIncident.lastSeenAt,
    })
    .from(externalServiceIncident)
    .where(and(eq(externalServiceIncident.externalServiceId, externalServiceId)))
    .orderBy(
      desc(
        sql`COALESCE(${externalServiceIncident.startedAt}, ${externalServiceIncident.createdAt})`,
      ),
      desc(externalServiceIncident.createdAt),
    )
    .limit(limit)
    .all();

  return rows;
}

export async function listExternalIncidentsBySlug(args: {
  ctx?: GlobalReadContext;
  slug: string;
  limit?: number;
}): Promise<{
  service: { id: number; apiConfigType?: string } | null;
  incidents: ExternalIncidentListItem[];
}> {
  const { ctx, slug } = args;
  const service = await getExternalServiceBySlug({ ctx, slug });
  if (!service) {
    return { service: null, incidents: [] };
  }

  const incidents = await listExternalIncidentsByServiceId({
    ctx,
    externalServiceId: service.id,
    limit: args.limit,
  });

  return {
    service: { id: service.id, apiConfigType: service.apiConfig?.type },
    incidents,
  };
}
