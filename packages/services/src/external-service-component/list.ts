import { and, asc, db as defaultDb, eq, gte } from "@openstatus/db";
import type { ApiConfigType } from "@openstatus/db/src/schema";
import { externalServiceComponent } from "@openstatus/db/src/schema";

import { getExternalServiceBySlug } from "../external-service";
import type { GlobalReadContext } from "../external-service/internal";

export type ExternalComponentListItem = {
  id: number;
  externalServiceId: number;
  upstreamComponentId: string;
  name: string;
  description: string | null;
  groupName: string | null;
  position: number;
  indicator: string;
  status: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

// A component absent from upstream for longer than this is hidden from the page
// without being deleted (ADR-0007): the next tick that re-sees it brings it back.
const COMPONENT_STALE_MS = 24 * 60 * 60 * 1000;

// must stay in sync with fetchers that implement `fetchComponents` in @openstatus/status-fetcher
export const COMPONENT_SUPPORTED_API_CONFIG_TYPES = new Set<ApiConfigType>([
  "atlassian",
  "incidentio",
]);

export function supportsComponents(type: ApiConfigType | undefined): boolean {
  return type !== undefined && COMPONENT_SUPPORTED_API_CONFIG_TYPES.has(type);
}

export async function listExternalComponentsByServiceId(args: {
  ctx?: GlobalReadContext;
  externalServiceId: number;
  now?: Date;
}): Promise<ExternalComponentListItem[]> {
  const { ctx, externalServiceId } = args;
  const db = ctx?.db ?? defaultDb;
  const cutoff = new Date(
    (args.now ?? new Date()).getTime() - COMPONENT_STALE_MS,
  );

  const rows = await db
    .select({
      id: externalServiceComponent.id,
      externalServiceId: externalServiceComponent.externalServiceId,
      upstreamComponentId: externalServiceComponent.upstreamComponentId,
      name: externalServiceComponent.name,
      description: externalServiceComponent.description,
      groupName: externalServiceComponent.groupName,
      position: externalServiceComponent.position,
      indicator: externalServiceComponent.indicator,
      status: externalServiceComponent.status,
      firstSeenAt: externalServiceComponent.firstSeenAt,
      lastSeenAt: externalServiceComponent.lastSeenAt,
    })
    .from(externalServiceComponent)
    .where(
      and(
        eq(externalServiceComponent.externalServiceId, externalServiceId),
        gte(externalServiceComponent.lastSeenAt, cutoff),
      ),
    )
    .orderBy(
      asc(externalServiceComponent.position),
      asc(externalServiceComponent.name),
    )
    .all();

  return rows;
}

export type ListComponentsBySlugResult = {
  service: { id: number; apiConfigType?: ApiConfigType } | null;
  supported: boolean;
  components: ExternalComponentListItem[];
};

export async function listExternalComponentsBySlug(args: {
  ctx?: GlobalReadContext;
  slug: string;
  now?: Date;
}): Promise<ListComponentsBySlugResult> {
  const { ctx, slug } = args;
  const service = await getExternalServiceBySlug({ ctx, slug });
  if (!service) {
    return { service: null, supported: false, components: [] };
  }

  const apiConfigType = service.apiConfig?.type;
  if (!supportsComponents(apiConfigType)) {
    return {
      service: { id: service.id, apiConfigType },
      supported: false,
      components: [],
    };
  }

  const components = await listExternalComponentsByServiceId({
    ctx,
    externalServiceId: service.id,
    now: args.now,
  });

  return {
    service: { id: service.id, apiConfigType },
    supported: true,
    components,
  };
}
