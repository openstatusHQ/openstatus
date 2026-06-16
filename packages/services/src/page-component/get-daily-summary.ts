import { and, asc, eq, inArray } from "@openstatus/db";
import { incidentTable, pageComponent } from "@openstatus/db/src/schema";
import type {
  PageComponentImpact,
  PageComponentType,
} from "@openstatus/db/src/schema";

import { type ServiceContext, defaultTb, getReadDb } from "../context";
import { NotFoundError } from "../errors";
import { fetchMonitorDailyStats } from "../monitor/get-daily-summary";
import {
  type DayStatus,
  type Event,
  eventWorstImpact,
  fillStatusDataFor45Days,
  getEvents,
  resolveDayStatus,
} from "../status-timeline";
import { GetPageComponentDailySummaryInput } from "./schemas";

export type ComponentDayBucket = {
  day: string;
  count: number;
  ok: number;
  degraded: number;
  error: number;
  status: DayStatus;
  impact?: PageComponentImpact;
};

export type ComponentEventSummary = {
  id: number;
  name: string;
  type: Event["type"];
  status: Event["status"];
  from: Date;
  to: Date | null;
  impact?: PageComponentImpact;
};

export type PageComponentDailySummary = {
  componentId: number;
  type: PageComponentType;
  monitorId?: number;
  name: string;
  buckets: ComponentDayBucket[];
  events: ComponentEventSummary[];
};

export type GetPageComponentDailySummaryResult = {
  components: PageComponentDailySummary[];
};

export async function getPageComponentDailySummary(args: {
  ctx: ServiceContext;
  input: GetPageComponentDailySummaryInput;
}): Promise<GetPageComponentDailySummaryResult> {
  const { ctx } = args;
  const input = GetPageComponentDailySummaryInput.parse(args.input);
  const db = getReadDb(ctx);
  const tb = ctx.tb ?? defaultTb;
  const days = input.days ?? 45;

  const conditions = [
    eq(pageComponent.pageId, input.pageId),
    eq(pageComponent.workspaceId, input.workspaceId),
  ];
  if (input.componentIds?.length) {
    conditions.push(inArray(pageComponent.id, input.componentIds));
  }

  const components = await db
    .select()
    .from(pageComponent)
    .where(and(...conditions))
    .orderBy(asc(pageComponent.order))
    .all();

  if (input.componentIds?.length) {
    const found = new Set(components.map((c) => c.id));
    for (const id of input.componentIds) {
      if (!found.has(id)) throw new NotFoundError("page_component", id);
    }
  }

  const monitorIds = Array.from(
    new Set(
      components.map((c) => c.monitorId).filter((m): m is number => m != null),
    ),
  );

  const [monitorStats, maintenances, reports, incidents] = await Promise.all([
    fetchMonitorDailyStats({
      db,
      tb,
      monitorIds,
      workspaceId: input.workspaceId,
    }),
    db.query.maintenance.findMany({
      where: (m, { eq }) => eq(m.pageId, input.pageId),
      with: { maintenancesToPageComponents: { with: { pageComponent: true } } },
    }),
    db.query.statusReport.findMany({
      where: (r, { eq }) => eq(r.pageId, input.pageId),
      with: {
        statusReportsToPageComponents: { with: { pageComponent: true } },
        statusReportUpdates: {
          with: { statusReportUpdateToPageComponents: true },
        },
      },
    }),
    monitorIds.length > 0
      ? db
          .select()
          .from(incidentTable)
          .where(inArray(incidentTable.monitorId, monitorIds))
          .all()
      : Promise.resolve([]),
  ]);

  const statsByMonitor = new Map<string, typeof monitorStats>();
  for (const stat of monitorStats) {
    const arr = statsByMonitor.get(stat.monitorId);
    if (arr) arr.push(stat);
    else statsByMonitor.set(stat.monitorId, [stat]);
  }

  const summaries = components.map((component) => {
    const events = getEvents({
      maintenances,
      incidents,
      reports,
      pageComponentId: component.id,
      monitorId: component.monitorId ?? undefined,
      componentType: component.type,
      pastDays: days,
    });

    const monitorKey =
      component.monitorId != null ? String(component.monitorId) : "";
    const stats = statsByMonitor.get(monitorKey) ?? [];
    const filled = fillStatusDataFor45Days(stats, monitorKey, days);

    const buckets: ComponentDayBucket[] = filled.map((bucket) => {
      const { status, impact } = resolveDayStatus(bucket, events);
      return {
        day: bucket.day,
        count: bucket.count,
        ok: bucket.ok,
        degraded: bucket.degraded,
        error: bucket.error,
        status,
        impact,
      };
    });

    const eventSummaries: ComponentEventSummary[] = events.map((event) => ({
      id: event.id,
      name: event.name,
      type: event.type,
      status: event.status,
      from: event.from,
      to: event.to,
      impact: eventWorstImpact(event),
    }));

    return {
      componentId: component.id,
      type: component.type,
      monitorId: component.monitorId ?? undefined,
      name: component.name,
      buckets,
      events: eventSummaries,
    };
  });

  return { components: summaries };
}
