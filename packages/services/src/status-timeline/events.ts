import type {
  Incident,
  Maintenance,
  PageComponent,
  PageComponentImpact,
  PageComponentType,
  PageComponentWithMonitorRelation,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";
import {
  currentImpactsFromUpdates,
  impactToStatusType,
  worstImpact,
} from "@openstatus/db/src/schema";

export type MonitorComponentWithNonNullMonitor =
  PageComponentWithMonitorRelation & {
    type: "monitor";
    monitorId: number;
    monitor: NonNullable<PageComponentWithMonitorRelation["monitor"]>;
  };

export function isMonitorComponent(
  component: PageComponentWithMonitorRelation,
): component is MonitorComponentWithNonNullMonitor {
  return (
    component.type === "monitor" &&
    component.monitor !== null &&
    component.monitor !== undefined &&
    component.monitor.active === true &&
    component.monitor.deletedAt === null
  );
}

export type StatusData = {
  day: string;
  count: number;
  ok: number;
  degraded: number;
  error: number;
  monitorId: string;
};

export function fillStatusDataFor45Days(
  data: Array<StatusData>,
  monitorId: string,
  lookbackPeriod = 45,
): Array<StatusData> {
  const result = [];
  const dataByDay = new Map();

  // Index existing data by day
  data.forEach((item) => {
    const dayKey = new Date(item.day).toISOString().split("T")[0]; // YYYY-MM-DD format
    dataByDay.set(dayKey, item);
  });

  // Generate all days from today backwards
  const now = new Date();
  for (let i = 0; i < lookbackPeriod; i++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    date.setUTCHours(0, 0, 0, 0); // Set to start of day in UTC

    const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD format
    const isoString = date.toISOString();

    if (dataByDay.has(dayKey)) {
      // Use existing data but ensure the day is properly formatted
      const existingData = dataByDay.get(dayKey);
      result.push({
        ...existingData,
        day: isoString,
      });
    } else {
      // Fill missing day with default values
      result.push({
        day: isoString,
        count: 0,
        ok: 0,
        degraded: 0,
        error: 0,
        monitorId,
      });
    }
  }

  // Sort by day (oldest first)
  return result.sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );
}

export function fillStatusDataFor45DaysNoop({
  errorDays,
  degradedDays,
  lookbackPeriod = 45,
}: {
  errorDays: number[];
  degradedDays: number[];
  lookbackPeriod?: number;
}): Array<StatusData> {
  const issueDays = [...errorDays, ...degradedDays];
  // UTC day grid, matching fillStatusDataFor45Days, so synthetic days line up
  const data: StatusData[] = Array.from({ length: lookbackPeriod }, (_, i) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    date.setUTCHours(0, 0, 0, 0);
    return {
      day: date.toISOString(),
      count: 1,
      ok: issueDays.includes(i) ? 0 : 1,
      degraded: degradedDays.includes(i) ? 1 : 0,
      error: errorDays.includes(i) ? 1 : 0,
      monitorId: "1",
    };
  });
  return fillStatusDataFor45Days(data, "1", lookbackPeriod);
}

export type ImpactInterval = {
  from: Date;
  to: Date | null; // null = still active
  impact: PageComponentImpact;
};

export type StatusReportUpdateWithImpactRows = StatusReportUpdate & {
  statusReportUpdateToPageComponents?: {
    pageComponentId: number;
    impact: PageComponentImpact;
  }[];
};

export type Event = {
  id: number;
  name: string;
  from: Date;
  to: Date | null;
  type: "maintenance" | "incident" | "report";
  status: "success" | "degraded" | "error" | "info";
  // absent ⇒ legacy report (no impact rows): orange bar, full-duration downtime
  impactIntervals?: ImpactInterval[];
};

// per component: change points across the report's updates
function buildComponentImpactIntervals(
  updates: StatusReportUpdateWithImpactRows[],
): Map<number, ImpactInterval[]> {
  // closing the last open interval relies on ascending order; don't trust callers
  const sorted = [...updates].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id,
  );
  const byComponent = new Map<number, ImpactInterval[]>();
  for (const update of sorted) {
    for (const row of update.statusReportUpdateToPageComponents ?? []) {
      const intervals = byComponent.get(row.pageComponentId) ?? [];
      const last = intervals[intervals.length - 1];
      if (last && last.to === null) last.to = update.date;
      intervals.push({ from: update.date, to: null, impact: row.impact });
      byComponent.set(row.pageComponentId, intervals);
    }
  }
  return byComponent;
}

// page-level projection: worst impact across components per time slice
function mergeWorstImpactIntervals(
  perComponent: ImpactInterval[][],
): ImpactInterval[] {
  const all = perComponent.flat();
  if (all.length === 0) return [];

  const boundaries = [...new Set(all.map((iv) => iv.from.getTime()))].sort(
    (a, b) => a - b,
  );

  const merged: ImpactInterval[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const sliceStart = boundaries[i];
    const sliceEnd = i + 1 < boundaries.length ? boundaries[i + 1] : null;
    const active = all.filter(
      (iv) =>
        iv.from.getTime() <= sliceStart &&
        (iv.to === null || iv.to.getTime() > sliceStart),
    );
    if (active.length === 0) continue;
    const impact = worstImpact(active.map((iv) => iv.impact));
    const last = merged[merged.length - 1];
    if (
      last &&
      last.impact === impact &&
      last.to !== null &&
      last.to.getTime() === sliceStart
    ) {
      last.to = sliceEnd === null ? null : new Date(sliceEnd);
    } else {
      merged.push({
        from: new Date(sliceStart),
        to: sliceEnd === null ? null : new Date(sliceEnd),
        impact,
      });
    }
  }
  return merged;
}

// keep impact downtime inside the event window the rest of the math uses
function clampOpenIntervals(
  intervals: ImpactInterval[] | undefined,
  to: Date | null,
): ImpactInterval[] | undefined {
  if (!intervals || to === null) return intervals;
  return intervals.map((iv) => (iv.to === null ? { ...iv, to } : iv));
}

/**
 * Current impact per component: the latest update (by date, ties by id) that
 * names it wins. Empty map ⇒ legacy report.
 */
export function currentImpactByComponent(report: {
  statusReportUpdates: StatusReportUpdateWithImpactRows[];
}): Map<number, PageComponentImpact> {
  return currentImpactsFromUpdates(
    report.statusReportUpdates.map((u) => ({
      id: u.id,
      date: u.date,
      componentImpacts: u.statusReportUpdateToPageComponents ?? [],
    })),
  );
}

/**
 * Worst status among still-active report events. "success"-status reports
 * (everything operational for this projection) don't flag the component.
 */
export function activeReportStatus(
  events: Event[],
): "error" | "degraded" | undefined {
  let worst: "error" | "degraded" | undefined;
  for (const e of events) {
    if (e.type !== "report" || e.to) continue;
    if (e.status === "error") return "error";
    if (e.status !== "success") worst = "degraded";
  }
  return worst;
}

export function getEvents({
  maintenances,
  incidents,
  reports,
  pageComponentId,
  monitorId,
  componentType,
  pastDays = 45,
}: {
  maintenances: (Maintenance & {
    maintenancesToPageComponents: {
      pageComponent: PageComponent | null;
    }[];
  })[];
  incidents: Incident[];
  reports: (StatusReport & {
    statusReportsToPageComponents: {
      pageComponent: PageComponent | null;
    }[];
    statusReportUpdates: StatusReportUpdateWithImpactRows[];
  })[];
  pageComponentId?: number;
  monitorId?: number;
  componentType?: PageComponentType;
  pastDays?: number;
}): Event[] {
  const events: Event[] = [];
  const pastThreshold = new Date();
  pastThreshold.setDate(pastThreshold.getDate() - pastDays);

  // Filter maintenances - prioritize pageComponentId, fallback to monitorId for backward compatibility
  maintenances
    .filter((maintenance) => {
      if (pageComponentId) {
        return maintenance.maintenancesToPageComponents.some(
          (m) => m.pageComponent?.id === pageComponentId,
        );
      }
      if (monitorId) {
        return maintenance.maintenancesToPageComponents.some(
          (m) => m.pageComponent?.monitorId === monitorId,
        );
      }
      return true;
    })
    .forEach((maintenance) => {
      if (maintenance.from < pastThreshold) return;
      events.push({
        id: maintenance.id,
        name: maintenance.title,
        from: maintenance.from,
        to: maintenance.to,
        type: "maintenance",
        status: "info" as const,
      });
    });

  // Filter incidents - only for monitor-type components
  // Static components don't have incidents
  if (componentType !== "static") {
    incidents
      .filter((incident) =>
        monitorId ? incident.monitorId === monitorId : true,
      )
      .forEach((incident) => {
        if (!incident.createdAt || incident.createdAt < pastThreshold) return;
        events.push({
          id: incident.id,
          name: "Downtime",
          from: incident.createdAt,
          to: incident.resolvedAt,
          type: "incident",
          status: "error" as const,
        });
      });
  }

  // Filter reports - prioritize pageComponentId, fallback to monitorId for backward compatibility
  reports
    .filter((report) => {
      if (pageComponentId) {
        return report.statusReportsToPageComponents.some(
          (r) => r.pageComponent?.id === pageComponentId,
        );
      }
      if (monitorId) {
        return report.statusReportsToPageComponents.some(
          (r) => r.pageComponent?.monitorId === monitorId,
        );
      }
      return true;
    })
    .map((report) => {
      const updates = [...report.statusReportUpdates].sort(
        (a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id,
      );
      if (updates.length === 0) return;

      const firstUpdate = updates[0];
      const lastUpdate = updates[updates.length - 1];

      // NOTE: we don't check threshold here because we display all unresolved reports
      if (!firstUpdate?.date) return;

      const componentIntervals = buildComponentImpactIntervals(updates);
      const hasImpacts = componentIntervals.size > 0;

      const targetComponentId =
        pageComponentId ??
        (monitorId
          ? report.statusReportsToPageComponents.find(
              (r) => r.pageComponent?.monitorId === monitorId,
            )?.pageComponent?.id
          : undefined);

      // per-component view projects that component's timeline; page-level
      // takes the worst impact across components per time slice
      let impactIntervals: ImpactInterval[] | undefined;
      if (hasImpacts) {
        impactIntervals =
          targetComponentId !== undefined
            ? (componentIntervals.get(targetComponentId) ?? [])
            : mergeWorstImpactIntervals([...componentIntervals.values()]);
      }

      // HACKY: LEGACY: we shouldn't have report.status anymore and instead use the update status for that.
      if (report.status === "resolved") {
        const to = lastUpdate?.date ?? null;
        // unresolved reports show regardless of age; a resolved report that
        // ended before the window is out of range — drop it
        if (to !== null && to < pastThreshold) return;
        events.push({
          id: report.id,
          name: report.title,
          from: firstUpdate?.date,
          to,
          type: "report",
          status: "success" as const,
          impactIntervals: clampOpenIntervals(impactIntervals, to),
        });
        return;
      }

      const to =
        lastUpdate?.status === "resolved" || lastUpdate?.status === "monitoring"
          ? lastUpdate?.date
          : null;

      // derived from the open (current) impacts; legacy stays flat orange.
      // No open non-operational interval — including the empty-projection
      // case (component never named by any update) — reads "success" BY
      // DESIGN: an open report whose impacts are all cleared no longer
      // flags the component, even before the report is formally resolved.
      const openImpacts = (impactIntervals ?? [])
        .filter((iv) => iv.to === null)
        .map((iv) => iv.impact);
      const status = hasImpacts
        ? impactToStatusType(worstImpact(openImpacts))
        : ("degraded" as const);

      events.push({
        id: report.id,
        name: report.title,
        from: firstUpdate?.date,
        to,
        type: "report",
        status,
        impactIntervals: clampOpenIntervals(impactIntervals, to),
      });
    });

  return events;
}

// Keep the old function name for backward compatibility
export const getEventsByMonitorId = getEvents;

// Priority mapping for status types (higher number = higher priority)
const STATUS_PRIORITY = {
  error: 3,
  degraded: 2,
  info: 1,
  success: 0,
  empty: -1,
} as const;

export function getWorstVariant<T extends keyof typeof STATUS_PRIORITY>(
  statuses: T[],
): T | "success" {
  return statuses.reduce<T | "success">(
    (worst, current) =>
      STATUS_PRIORITY[current] > STATUS_PRIORITY[worst] ? current : worst,
    "success",
  );
}

// Helper to get highest priority status from data
export function getHighestPriorityStatus(
  item: StatusData,
): keyof typeof STATUS_PRIORITY {
  if (item.error > 0) return "error";
  if (item.degraded > 0) return "degraded";
  if (item.ok > 0) return "success";

  return "empty";
}

// worst report impact for one day; null = legacy event (no impact rows)
export function reportEventDayImpact(
  event: Event,
  date: Date,
): PageComponentImpact | null {
  if (!event.impactIntervals) return null;

  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const overlapping = event.impactIntervals.filter((iv) => {
    const end = iv.to ?? new Date();
    return (
      iv.from.getTime() <= endOfDay.getTime() &&
      end.getTime() >= startOfDay.getTime()
    );
  });
  return worstImpact(overlapping.map((iv) => iv.impact));
}

// worst projected report color for one day; legacy events stay orange
export function reportEventDayStatus(
  event: Event,
  date: Date,
): "success" | "degraded" | "error" {
  const impact = reportEventDayImpact(event, date);
  return impact === null ? "degraded" : impactToStatusType(impact);
}

// Helper to check if date is within event range
export function isDateWithinEvent(date: Date, event: Event): boolean {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const eventStart = new Date(event.from);
  const eventEnd = event.to ? new Date(event.to) : new Date();

  return (
    eventStart.getTime() <= endOfDay.getTime() &&
    eventEnd.getTime() >= startOfDay.getTime()
  );
}

export type DayStatus =
  | "operational"
  | "degraded"
  | "down"
  | "maintenance"
  | "empty";

// Convenience per-day status: event severity (incident > report > maintenance)
// wins, else fall back to the uptime buckets. Mirrors the "dominant" bar rule.
export function resolveDayStatus(
  bucket: StatusData,
  events: Event[],
): { status: DayStatus; impact?: PageComponentImpact } {
  const date = new Date(bucket.day);
  const dayEvents = events.filter((e) => isDateWithinEvent(date, e));
  const reports = dayEvents.filter((e) => e.type === "report");

  const dayImpacts = reports
    .map((e) => reportEventDayImpact(e, date))
    .filter((i): i is PageComponentImpact => i !== null);
  const impact = dayImpacts.length > 0 ? worstImpact(dayImpacts) : undefined;

  if (dayEvents.some((e) => e.type === "incident")) {
    return { status: "down", impact };
  }

  const reportsDayStatus = reports.length
    ? getWorstVariant(reports.map((e) => reportEventDayStatus(e, date)))
    : undefined;
  if (reportsDayStatus && reportsDayStatus !== "success") {
    return {
      status: reportsDayStatus === "error" ? "down" : "degraded",
      impact,
    };
  }

  if (dayEvents.some((e) => e.type === "maintenance")) {
    return { status: "maintenance", impact };
  }

  switch (getHighestPriorityStatus(bucket)) {
    case "error":
      return { status: "down" };
    case "degraded":
      return { status: "degraded" };
    case "success":
      return { status: "operational" };
    default:
      return { status: "empty" };
  }
}

// worst impact over the whole event (reports only); undefined ⇒ no impact rows
export function eventWorstImpact(
  event: Event,
): PageComponentImpact | undefined {
  if (!event.impactIntervals || event.impactIntervals.length === 0) {
    return undefined;
  }
  return worstImpact(event.impactIntervals.map((iv) => iv.impact));
}
