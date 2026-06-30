import { and, db as defaultDb, inArray, isNull } from "@openstatus/db";
import {
  type ExternalStatusType,
  externalIndicatorToStatus,
  externalService,
  worstExternalIndicator,
} from "@openstatus/db/src/schema";

import { defaultTb } from "../context";
import {
  type ExternalComponentListItem,
  listExternalComponentsByServiceId,
} from "../external-service-component";
import {
  type ExternalIncidentListItem,
  listExternalIncidentsByServiceId,
} from "../external-service-incident";
import { retryRead } from "../retry";
import type { GlobalReadContext } from "./internal";

export type ExternalPageComponentInput = {
  pageComponentId: number;
  name: string;
  description: string | null;
  order: number;
  externalServiceId: number;
  externalServiceComponentId: number | null;
};

export type ExternalDailyRow = {
  day: string;
  worstIndicator: string;
  hadMaintenance: number;
};

export type ExternalSectionComponent = {
  pageComponentId: number;
  name: string;
  description: string | null;
  status: ExternalStatusType;
  stale: boolean;
  isWholeService: boolean;
  daily: ExternalDailyRow[];
};

export type ExternalSectionProvider = {
  externalServiceId: number;
  name: string;
  slug: string;
  statusPageUrl: string;
  status: ExternalStatusType;
  order: number;
  components: ExternalSectionComponent[];
};

export type ExternalSectionIncident = ExternalIncidentListItem & {
  serviceName: string;
  serviceSlug: string;
};

export type PageExternalSection = {
  position: number | null;
  providers: ExternalSectionProvider[];
  incidents: ExternalSectionIncident[];
};

const DEFAULT_DAYS = 45;
const INCIDENTS_LIMIT = 10;

async function safeData<T>(promise: Promise<{ data: T[] }>): Promise<T[]> {
  try {
    return (await promise).data;
  } catch (err) {
    console.warn("[external-section] tinybird history failed:", err);
    return [];
  }
}

function worstStatus(statuses: ExternalStatusType[]): ExternalStatusType {
  const order: ExternalStatusType[] = ["success", "info", "degraded", "error"];
  let worst: ExternalStatusType = "empty";
  for (const s of statuses) {
    if (s === "empty") continue;
    if (worst === "empty" || order.indexOf(s) > order.indexOf(worst)) {
      worst = s;
    }
  }
  return worst;
}

export async function getPageExternalSection(args: {
  ctx?: GlobalReadContext;
  components: ExternalPageComponentInput[];
  days?: number;
  now?: Date;
}): Promise<PageExternalSection> {
  const { ctx, components } = args;
  const days = args.days ?? DEFAULT_DAYS;
  if (components.length === 0) {
    return { position: null, providers: [], incidents: [] };
  }

  const db = ctx?.db ?? defaultDb;
  const staleCutoff = (args.now ?? new Date()).getTime() - 24 * 60 * 60 * 1000;
  const serviceIds = Array.from(
    new Set(components.map((c) => c.externalServiceId)),
  );

  const serviceRows = await retryRead(() =>
    db
      .select({
        id: externalService.id,
        slug: externalService.slug,
        name: externalService.name,
        statusPageUrl: externalService.statusPageUrl,
      })
      .from(externalService)
      .where(
        and(
          inArray(externalService.id, serviceIds),
          isNull(externalService.deletedAt),
        ),
      )
      .all(),
  );
  const serviceById = new Map(serviceRows.map((s) => [s.id, s]));

  const liveByService = new Map<
    number,
    Map<number, ExternalComponentListItem>
  >();
  await Promise.all(
    serviceIds.map(async (id) => {
      const live = await listExternalComponentsByServiceId({
        ctx,
        externalServiceId: id,
        now: args.now,
      });
      liveByService.set(id, new Map(live.map((c) => [c.id, c])));
    }),
  );

  const componentHistIds = components
    .filter((c) => c.externalServiceComponentId != null)
    .map((c) => String(c.externalServiceComponentId));
  const serviceHistSlugs = Array.from(
    new Set(
      components
        .filter((c) => c.externalServiceComponentId == null)
        .map((c) => serviceById.get(c.externalServiceId)?.slug)
        .filter((slug): slug is string => !!slug),
    ),
  );

  const hasTb = !!process.env.TINY_BIRD_API_KEY;
  const [componentHistory, serviceHistory, serviceLatest] = await Promise.all([
    hasTb && componentHistIds.length > 0
      ? safeData(
          defaultTb.externalStatusComponentHistory({
            component_ids: componentHistIds,
            days,
          }),
        )
      : Promise.resolve([]),
    hasTb && serviceHistSlugs.length > 0
      ? safeData(
          defaultTb.externalStatusHistory({ ids: serviceHistSlugs, days }),
        )
      : Promise.resolve([]),
    hasTb && serviceHistSlugs.length > 0
      ? safeData(defaultTb.externalStatusLatest({ ids: serviceHistSlugs }))
      : Promise.resolve([]),
  ]);

  const serviceLatestBySlug = new Map(serviceLatest.map((r) => [r.id, r]));

  const componentDaily = new Map<string, ExternalDailyRow[]>();
  for (const row of componentHistory) {
    const arr = componentDaily.get(row.component_id) ?? [];
    arr.push({
      day: row.day,
      worstIndicator: row.worst_indicator,
      hadMaintenance: row.had_maintenance,
    });
    componentDaily.set(row.component_id, arr);
  }
  const serviceDaily = new Map<string, ExternalDailyRow[]>();
  for (const row of serviceHistory) {
    const arr = serviceDaily.get(row.id) ?? [];
    arr.push({
      day: row.day,
      worstIndicator: row.worst_indicator,
      hadMaintenance: row.had_maintenance,
    });
    serviceDaily.set(row.id, arr);
  }

  const providers = new Map<number, ExternalSectionProvider>();
  for (const c of components) {
    const service = serviceById.get(c.externalServiceId);
    if (!service) continue;
    const live = liveByService.get(c.externalServiceId) ?? new Map();

    let status: ExternalStatusType;
    let stale: boolean;
    let daily: ExternalDailyRow[];
    if (c.externalServiceComponentId == null) {
      const liveItems = Array.from(live.values());
      const indicators = liveItems.map((x) => x.indicator);
      if (indicators.length > 0) {
        const maintenance = liveItems.some(
          (x) => x.status === "under_maintenance",
        );
        status = externalIndicatorToStatus(
          worstExternalIndicator(indicators),
          maintenance,
        );
        stale = false;
      } else {
        const latest = serviceLatestBySlug.get(service.slug);
        const fresh = latest != null && latest.last_fetched_at >= staleCutoff;
        status = fresh
          ? externalIndicatorToStatus(
              latest.indicator,
              latest.status === "under_maintenance",
            )
          : "empty";
        stale = !fresh;
      }
      daily = serviceDaily.get(service.slug) ?? [];
    } else {
      const item = live.get(c.externalServiceComponentId);
      status = item
        ? externalIndicatorToStatus(
            item.indicator,
            item.status === "under_maintenance",
          )
        : "empty";
      stale = !item;
      daily = componentDaily.get(String(c.externalServiceComponentId)) ?? [];
    }

    const sectionComponent: ExternalSectionComponent = {
      pageComponentId: c.pageComponentId,
      name: c.name,
      description: c.description,
      status,
      stale,
      isWholeService: c.externalServiceComponentId == null,
      daily,
    };

    const existing = providers.get(c.externalServiceId);
    if (existing) {
      existing.components.push(sectionComponent);
      existing.order = Math.min(existing.order, c.order);
    } else {
      providers.set(c.externalServiceId, {
        externalServiceId: c.externalServiceId,
        name: service.name,
        slug: service.slug,
        statusPageUrl: service.statusPageUrl,
        status: "empty",
        order: c.order,
        components: [sectionComponent],
      });
    }
  }

  for (const provider of providers.values()) {
    provider.status = worstStatus(provider.components.map((x) => x.status));
  }

  const incidentLists = await Promise.all(
    serviceIds.map(async (id) => {
      const service = serviceById.get(id);
      if (!service) return [];
      const incidents = await listExternalIncidentsByServiceId({
        ctx,
        externalServiceId: id,
        limit: INCIDENTS_LIMIT,
      });
      return incidents.map((i) => ({
        ...i,
        serviceName: service.name,
        serviceSlug: service.slug,
      }));
    }),
  );
  const incidents = incidentLists
    .flat()
    .sort((a, b) => {
      const at = (a.startedAt ?? a.createdAt).getTime();
      const bt = (b.startedAt ?? b.createdAt).getTime();
      return bt - at;
    })
    .slice(0, INCIDENTS_LIMIT);

  const position = Math.min(...components.map((c) => c.order));

  return {
    position,
    providers: Array.from(providers.values()).sort((a, b) => a.order - b.order),
    incidents,
  };
}
