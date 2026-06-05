import { and, db as defaultDb, desc, eq, sql } from "@openstatus/db";
import type { ApiConfigType } from "@openstatus/db/src/schema";
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

// must stay in sync with fetchers that implement `fetchIncidents` in @openstatus/status-fetcher
export const INCIDENT_SUPPORTED_API_CONFIG_TYPES = new Set<ApiConfigType>([
  "atlassian",
  "incidentio",
]);

export function supportsIncidents(type: ApiConfigType | undefined): boolean {
  return type !== undefined && INCIDENT_SUPPORTED_API_CONFIG_TYPES.has(type);
}

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
    .where(eq(externalServiceIncident.externalServiceId, externalServiceId))
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

// Incidents whose Atlassian `components[]` array tagged this component (matched
// by the upstream component id stored in `affected_component_ids`), recent-first.
export async function listExternalIncidentsByComponent(args: {
  ctx?: GlobalReadContext;
  externalServiceId: number;
  upstreamComponentId: string;
  limit?: number;
}): Promise<ExternalIncidentListItem[]> {
  const { ctx, externalServiceId, upstreamComponentId } = args;
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
    .where(
      and(
        eq(externalServiceIncident.externalServiceId, externalServiceId),
        sql`EXISTS (SELECT 1 FROM json_each(${externalServiceIncident.affectedComponentIds}) WHERE value = ${upstreamComponentId})`,
      ),
    )
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

export type ListBySlugResult = {
  service: { id: number; apiConfigType?: ApiConfigType } | null;
  supported: boolean;
  incidents: ExternalIncidentListItem[];
};

export async function listExternalIncidentsBySlug(args: {
  ctx?: GlobalReadContext;
  slug: string;
  limit?: number;
}): Promise<ListBySlugResult> {
  const { ctx, slug } = args;
  const service = await getExternalServiceBySlug({ ctx, slug });
  if (!service) {
    return { service: null, supported: false, incidents: [] };
  }

  const apiConfigType = service.apiConfig?.type;
  if (!supportsIncidents(apiConfigType)) {
    return {
      service: { id: service.id, apiConfigType },
      supported: false,
      incidents: [],
    };
  }

  const incidents = await listExternalIncidentsByServiceId({
    ctx,
    externalServiceId: service.id,
    limit: args.limit,
  });

  return {
    service: { id: service.id, apiConfigType },
    supported: true,
    incidents,
  };
}
