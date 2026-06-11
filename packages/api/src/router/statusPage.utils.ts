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
  LEGACY_IMPACT_WEIGHT,
  currentImpactsFromUpdates,
  impactToStatusType,
  impactUptimeWeight,
  worstImpact,
} from "@openstatus/db/src/schema";

/**
 * Type for a monitor component with a non-null monitor relation
 */
export type MonitorComponentWithNonNullMonitor =
  PageComponentWithMonitorRelation & {
    type: "monitor";
    monitorId: number;
    monitor: NonNullable<PageComponentWithMonitorRelation["monitor"]>;
  };

/**
 * Type guard to check if a pageComponent is a monitor type with a monitor relation
 * Works with any object that has the shape of a pageComponent with a valid monitor relation
 */
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

  // Generate all 45 days from today backwards
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
  const data: StatusData[] = Array.from({ length: 45 }, (_, i) => {
    return {
      day: new Date(new Date().setDate(new Date().getDate() - i)).toISOString(),
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

type Event = {
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
  const pastThreshod = new Date();
  pastThreshod.setDate(pastThreshod.getDate() - pastDays);

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
      if (maintenance.from < pastThreshod) return;
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
        if (!incident.createdAt || incident.createdAt < pastThreshod) return;
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

export function getWorstVariant<T extends keyof typeof STATUS_PRIORITY>(
  statuses: T[],
): T | "success" {
  return statuses.reduce<T | "success">(
    (worst, current) =>
      STATUS_PRIORITY[current] > STATUS_PRIORITY[worst] ? current : worst,
    "success",
  );
}

type UptimeData = {
  day: string;
  events: Event[];
  bar: {
    status: "success" | "degraded" | "error" | "info" | "empty";
    height: number; // percentage
  }[];
  card: {
    status: "success" | "degraded" | "error" | "info" | "empty";
    value: string;
    /** Worst report impact of the day — refines the generic status label. */
    impact?: PageComponentImpact;
  }[];
};

// Priority mapping for status types (higher number = higher priority)
const STATUS_PRIORITY = {
  error: 3,
  degraded: 2,
  info: 1,
  success: 0,
  empty: -1,
} as const;

// Constants for time calculations
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_MINUTE = 1000 * 60;

// Helper to get highest priority status from data
function getHighestPriorityStatus(
  item: StatusData,
): keyof typeof STATUS_PRIORITY {
  if (item.error > 0) return "error";
  if (item.degraded > 0) return "degraded";
  if (item.ok > 0) return "success";

  return "empty";
}

// Helper to format numbers
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

// Helper to check if date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Helper to format duration from minutes
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

// worst report impact for one day; null = legacy event (no impact rows)
function reportEventDayImpact(
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
function reportEventDayStatus(
  event: Event,
  date: Date,
): "success" | "degraded" | "error" {
  const impact = reportEventDayImpact(event, date);
  return impact === null ? "degraded" : impactToStatusType(impact);
}

// Helper to check if date is within event range
function isDateWithinEvent(date: Date, event: Event): boolean {
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

// Helper to calculate total minutes in a day (handles today vs past days)
function getTotalMinutesInDay(date: Date): number {
  const now = new Date();
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);

  if (isToday(date)) {
    const minutesElapsed = Math.floor(
      (now.getTime() - startOfDay.getTime()) / MILLISECONDS_PER_MINUTE,
    );
    return minutesElapsed;
  }
  return 24 * 60;
}

// Helper to calculate duration in minutes for a specific event type
function calculateEventDurationMinutes(events: Event[], date: Date): number {
  const totalDuration = getTotalEventsDurationMs(events, date);
  return Math.round(totalDuration / MILLISECONDS_PER_MINUTE);
}

// Helper to calculate maintenance duration in minutes for a specific day
function getMaintenanceDurationMinutes(
  maintenances: Event[],
  date: Date,
): number {
  return calculateEventDurationMinutes(maintenances, date);
}

// Helper to get adjusted total minutes accounting for maintenance
function getAdjustedTotalMinutesInDay(
  date: Date,
  maintenances: Event[],
): number {
  const totalMinutes = getTotalMinutesInDay(date);
  const maintenanceMinutes = getMaintenanceDurationMinutes(maintenances, date);
  return Math.max(0, totalMinutes - maintenanceMinutes);
}

function getTotalEventsDurationMs(events: Event[], date: Date): number {
  if (events.length === 0) return 0;

  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const total = events.reduce((acc, curr) => {
    if (!curr.from) return acc;

    const eventStart = new Date(curr.from);
    const eventEnd = curr.to ? new Date(curr.to) : new Date();

    // Only count events that overlap with this date
    if (
      eventEnd.getTime() < startOfDay.getTime() ||
      eventStart.getTime() > endOfDay.getTime()
    ) {
      return acc;
    }

    // Calculate the overlapping duration within the date boundaries
    const overlapStart = Math.max(eventStart.getTime(), startOfDay.getTime());
    const overlapEnd = Math.min(eventEnd.getTime(), endOfDay.getTime());

    const duration = overlapEnd - overlapStart;
    return acc + Math.max(0, duration);
  }, 0);

  // Cap at 24 hours per day
  return Math.min(total, MILLISECONDS_PER_DAY);
}

export function setDataByType({
  events,
  data,
  cardType,
  barType,
}: {
  events: Event[];
  data: StatusData[];
  cardType: "requests" | "duration" | "dominant" | "manual";
  barType: "absolute" | "dominant" | "manual";
}): UptimeData[] {
  // Helper functions moved inside to share inputs and avoid parameter passing
  function createEventSegments(
    incidents: Event[],
    reports: Event[],
    maintenances: Event[],
    date: Date,
  ): Array<{ status: "info" | "degraded" | "error"; count: number }> {
    // impact reports contribute per-interval slices to each color bucket, so a
    // 1h major_outage inside a 24h report only paints 1h red; legacy reports
    // keep their full duration in the degraded bucket; operational slices drop
    const degradedSlices: Event[] = [];
    const errorSlices: Event[] = [];
    for (const report of reports) {
      if (!report.impactIntervals) {
        degradedSlices.push(report);
        continue;
      }
      for (const iv of report.impactIntervals) {
        const color = impactToStatusType(iv.impact);
        if (color === "success") continue;
        const slice = { ...report, from: iv.from, to: iv.to };
        if (!isDateWithinEvent(date, slice)) continue;
        (color === "error" ? errorSlices : degradedSlices).push(slice);
      }
    }

    const eventTypes = [
      { status: "info" as const, events: maintenances },
      { status: "degraded" as const, events: degradedSlices },
      {
        status: "error" as const,
        events: [...incidents, ...errorSlices],
      },
    ];

    return eventTypes
      .filter(({ events }) => events.length > 0)
      .map(({ status, events }) => ({
        status,
        count: getTotalEventsDurationMs(events, date),
      }));
  }

  function createErrorOnlyBarData(
    errorSegmentCount: number,
  ): UptimeData["bar"] {
    return [
      {
        status: "success" as const,
        height:
          ((MILLISECONDS_PER_DAY - errorSegmentCount) / MILLISECONDS_PER_DAY) *
          100,
      },
      {
        status: "error" as const,
        height: (errorSegmentCount / MILLISECONDS_PER_DAY) * 100,
      },
    ];
  }

  function createProportionalBarData(
    segments: Array<{ status: "info" | "degraded" | "error"; count: number }>,
  ): UptimeData["bar"] {
    // Downtime keeps its true proportion of the day; maintenance/reports are
    // highlight events that fill the remaining space (no uptime shown).
    const errorMs = segments
      .filter((segment) => segment.status === "error")
      .reduce((sum, segment) => sum + segment.count, 0);
    const errorHeight =
      (Math.min(errorMs, MILLISECONDS_PER_DAY) / MILLISECONDS_PER_DAY) * 100;
    const remainingHeight = Math.max(0, 100 - errorHeight);

    const highlightSegments = segments.filter(
      (segment) => segment.status !== "error",
    );
    const highlightTotal = highlightSegments.reduce(
      (sum, segment) => sum + segment.count,
      0,
    );

    return segments.map((segment) => {
      if (segment.status === "error") {
        return { status: segment.status, height: errorHeight };
      }
      // instant highlight events (no duration) split the remaining space evenly
      return {
        status: segment.status,
        height:
          highlightTotal > 0
            ? (segment.count / highlightTotal) * remainingHeight
            : remainingHeight / highlightSegments.length,
      };
    });
  }

  function createStatusSegments(
    dayData: StatusData,
  ): Array<{ status: "success" | "degraded" | "error"; count: number }> {
    return [
      { status: "success" as const, count: dayData.ok },
      { status: "degraded" as const, count: dayData.degraded },
      { status: "error" as const, count: dayData.error },
    ];
  }

  function segmentsToBarData(
    segments: Array<{
      status: "success" | "degraded" | "error";
      count: number;
    }>,
    total: number,
  ): UptimeData["bar"] {
    return segments
      .filter((segment) => segment.count > 0)
      .map((segment) => ({
        status: segment.status,
        height: (segment.count / total) * 100,
      }));
  }

  function createOperationalBarData(): UptimeData["bar"] {
    return [
      {
        status: "success",
        height: 100,
      },
    ];
  }

  function createEmptyBarData(): UptimeData["bar"] {
    return [
      {
        status: "empty",
        height: 100,
      },
    ];
  }

  function createEmptyCardData(
    eventStatus?: "error" | "degraded" | "info" | "success" | "empty",
  ): UptimeData["card"] {
    return [{ status: eventStatus ?? "empty", value: "" }];
  }

  function createRequestEntries(dayData: StatusData): Array<{
    status: "success" | "degraded" | "error" | "info";
    count: number;
  }> {
    return [
      { status: "success" as const, count: dayData.ok },
      { status: "degraded" as const, count: dayData.degraded },
      { status: "error" as const, count: dayData.error },
      { status: "info" as const, count: 0 },
    ];
  }

  function createDurationEntries(dayData: StatusData): Array<{
    status: "success" | "degraded" | "error" | "info";
    count: number;
  }> {
    return [
      { status: "error" as const, count: dayData.error },
      { status: "degraded" as const, count: dayData.degraded },
      { status: "success" as const, count: dayData.ok },
      { status: "info" as const, count: 0 },
    ];
  }

  function entriesToRequestCardData(
    entries: Array<{
      status: "success" | "degraded" | "error" | "info";
      count: number;
    }>,
  ): UptimeData["card"] {
    return entries
      .filter((entry) => entry.count > 0)
      .map((entry) => ({
        status: entry.status,
        value: `${formatNumber(entry.count)} reqs`,
      }));
  }

  // Helper to calculate duration in minutes for a specific event type
  function calculateEventDurationMinutes(events: Event[], date: Date): number {
    const totalDuration = getTotalEventsDurationMs(events, date);
    return Math.round(totalDuration / MILLISECONDS_PER_MINUTE);
  }

  // Helper to create duration card data for a specific status
  function createDurationCardEntry(
    status: "error" | "degraded" | "info" | "success",
    events: Event[],
    date: Date,
    durationMap: Map<string, number>,
    maintenances: Event[] = [],
  ): {
    status: "error" | "degraded" | "info" | "success";
    value: string;
  } | null {
    if (status === "success") {
      // Calculate success duration as remaining time
      let totalEventMinutes = 0;
      durationMap.forEach((minutes) => (totalEventMinutes += minutes));

      // Use adjusted total minutes accounting for maintenance
      const totalMinutesInDay = getAdjustedTotalMinutesInDay(
        date,
        maintenances,
      );
      const successMinutes = Math.max(totalMinutesInDay - totalEventMinutes, 0);

      if (successMinutes === 0) return null;
      return {
        status,
        value: formatDuration(successMinutes),
      };
    }

    // For error, degraded, info - calculate from events
    const minutes = calculateEventDurationMinutes(events, date);
    durationMap.set(status, minutes);

    if (minutes === 0) return null;
    return {
      status,
      value: formatDuration(minutes),
    };
  }

  return data.map((dayData) => {
    const date = new Date(dayData.day);

    // Find events for this day
    const dayEvents = events.filter((event) => isDateWithinEvent(date, event));

    // Determine status override based on events
    const incidents = dayEvents.filter((e) => e.type === "incident");
    const reports = dayEvents.filter((e) => e.type === "report");
    const maintenances = dayEvents.filter((e) => e.type === "maintenance");

    const hasIncidents = incidents.length > 0;
    const hasMaintenances = maintenances.length > 0;

    // worst impact color across the day's reports; "success" (operational all
    // day) means reports don't color the day
    const reportsDayStatus = reports.length
      ? getWorstVariant(reports.map((e) => reportEventDayStatus(e, date)))
      : undefined;
    const activeReportsDayStatus =
      reportsDayStatus === "success" ? undefined : reportsDayStatus;

    const eventStatus = hasIncidents
      ? "error"
      : (activeReportsDayStatus ??
        (hasMaintenances ? ("info" as const) : undefined));

    // Calculate bar data based on barType
    // TODO: transform into a new Map<type, number>();
    let barData: UptimeData["bar"];

    const total = dayData.ok + dayData.degraded + dayData.error;
    const dataStatus = getHighestPriorityStatus(dayData);

    switch (barType) {
      case "absolute":
        if (eventStatus) {
          // Create segments based on event durations for the day
          const eventSegments = createEventSegments(
            incidents,
            reports,
            maintenances,
            date,
          );

          // Special case: if only errors exist, show uptime vs downtime
          if (
            eventSegments.length === 1 &&
            eventSegments[0].status === "error"
          ) {
            barData = createErrorOnlyBarData(eventSegments[0].count);
          } else {
            // Multiple segments: show proportional distribution
            barData = createProportionalBarData(eventSegments);
          }
        } else if (total === 0) {
          // Empty day - no data available
          barData = createEmptyBarData();
        } else {
          if (cardType === "duration") {
            // If no eventStatus and cardType is duration, show operational bar
            barData = createOperationalBarData();
          } else {
            // Multiple segments for absolute view - show proportional distribution of status data
            const statusSegments = createStatusSegments(dayData);
            barData = segmentsToBarData(statusSegments, total);
          }
        }
        break;
      case "dominant":
        barData = [
          {
            status: eventStatus ?? dataStatus,
            height: 100,
          },
        ];
        break;
      case "manual":
        const manualEventStatus =
          activeReportsDayStatus ?? (hasMaintenances ? "info" : undefined);
        barData = [
          {
            status: manualEventStatus || "success",
            height: 100,
          },
        ];
        break;
      default:
        // Default to dominant behavior
        barData = [
          {
            status: eventStatus ?? dataStatus,
            height: 100,
          },
        ];
        break;
    }

    // Calculate card data based on cardType
    // TODO: transform into a new Map<type, number>();
    let cardData: UptimeData["card"] = [];

    switch (cardType) {
      case "requests":
        if (total === 0) {
          cardData = createEmptyCardData(eventStatus);
        } else {
          const requestEntries = createRequestEntries(dayData);
          cardData = entriesToRequestCardData(requestEntries);
        }
        break;

      case "duration":
        if (total === 0) {
          cardData = createEmptyCardData(eventStatus);
        } else {
          const entries = createDurationEntries(dayData);
          const durationMap = new Map<string, number>();

          cardData = entries
            .map((entry) => {
              // Map each entry status to its corresponding events
              const eventMap = {
                error: incidents,
                degraded: reports,
                info: maintenances,
                success: [], // Success is calculated differently
              };

              const events = eventMap[entry.status as keyof typeof eventMap];
              return createDurationCardEntry(
                entry.status,
                events,
                date,
                durationMap,
                maintenances,
              );
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
        }
        break;

      case "dominant":
        cardData = [
          {
            status: eventStatus ?? dataStatus,
            value: "",
          },
        ];
        break;

      case "manual": {
        const manualCardStatus =
          activeReportsDayStatus ?? (hasMaintenances ? "info" : undefined);
        const dayImpacts = reports
          .map((e) => reportEventDayImpact(e, date))
          .filter((i): i is PageComponentImpact => i !== null);
        const worstDayImpact =
          dayImpacts.length > 0 ? worstImpact(dayImpacts) : null;
        cardData = [
          {
            status: manualCardStatus || "success",
            value: "",
            // only when the impact agrees with the day color — a mixed
            // legacy+impact day where legacy dominates keeps the generic label
            impact:
              worstDayImpact !== null &&
              impactToStatusType(worstDayImpact) === manualCardStatus
                ? worstDayImpact
                : undefined,
          },
        ];
        break;
      }
      default:
        // Default to requests behavior
        if (total === 0) {
          cardData = createEmptyCardData(eventStatus);
        } else {
          const defaultEntries = createRequestEntries(dayData);
          cardData = entriesToRequestCardData(defaultEntries);
        }
        break;
    }

    // Bundle incidents that occur on the same day if there are more than 4
    const bundledIncidents =
      incidents.length > 4
        ? [
            {
              id: -1, // Use -1 to indicate bundled incidents
              name: `Downtime (${incidents.length} incidents)`,
              from: new Date(
                Math.min(...incidents.map((i) => i.from.getTime())),
              ),
              to: new Date(
                Math.max(
                  ...incidents.map((i) => (i.to || new Date()).getTime()),
                ),
              ),
              type: "incident" as const,
              status: "error" as const,
              isAggregated: true,
            },
          ]
        : incidents;

    return {
      day: dayData.day,
      events: [
        ...reports,
        ...maintenances,
        ...(barType === "absolute" ? bundledIncidents : []),
      ],
      bar: barData,
      card: cardData,
    };
  });
}

type WeightedInterval = { from: number; to: number; weight: number };

// concurrent events describing the same outage must not double-count
// downtime: per time slice the worst (max) weight wins, mirroring
// mergeWorstImpactIntervals — summing could push uptime negative
function mergedDowntimeMs(intervals: WeightedInterval[]): number {
  const boundaries = [
    ...new Set(intervals.flatMap((iv) => [iv.from, iv.to])),
  ].sort((a, b) => a - b);

  let total = 0;
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const sliceStart = boundaries[i];
    const sliceEnd = boundaries[i + 1];
    let weight = 0;
    for (const iv of intervals) {
      if (iv.from <= sliceStart && iv.to >= sliceEnd) {
        weight = Math.max(weight, iv.weight);
      }
    }
    total += weight * (sliceEnd - sliceStart);
  }
  return total;
}

export function getUptime({
  data,
  events,
  barType,
  cardType,
}: {
  data: StatusData[];
  events: Event[];
  barType: "absolute" | "dominant" | "manual";
  cardType: "requests" | "duration" | "dominant" | "manual";
}): string {
  // Clamp event durations to the data lookback window to avoid
  // events outside the window producing negative uptime values.
  const timestamps = data.map((d) => new Date(d.day).getTime());
  const windowStart = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  const windowEndDate = new Date(
    timestamps.length > 0 ? Math.max(...timestamps) : Date.now(),
  );
  windowEndDate.setUTCHours(23, 59, 59, 999);
  const windowEnd = windowEndDate.getTime();

  function clampedInterval(
    from: Date,
    to: Date | null,
    weight: number,
  ): WeightedInterval | null {
    const start = Math.max(from.getTime(), windowStart);
    const end = Math.min((to ?? new Date()).getTime(), windowEnd);
    if (end <= start || weight === 0) return null;
    return { from: start, to: end, weight };
  }

  function reportImpactIntervals(event: Event): WeightedInterval[] {
    return (event.impactIntervals ?? [])
      .map((iv) =>
        clampedInterval(iv.from, iv.to, impactUptimeWeight(iv.impact)),
      )
      .filter((iv): iv is WeightedInterval => iv !== null);
  }

  if (barType === "manual") {
    // NOTE: we want only user events; legacy reports (no impact rows) keep
    // their full duration as downtime
    const intervals = events
      .filter((e) => e.type === "report")
      .flatMap((e) =>
        e.impactIntervals
          ? reportImpactIntervals(e)
          : (clampedInterval(e.from, e.to, LEGACY_IMPACT_WEIGHT) ?? []),
      );

    const total = data.length * MILLISECONDS_PER_DAY;
    if (total === 0) return "100%";
    const duration = mergedDowntimeMs(intervals);

    return `${Math.floor(((total - duration) / total) * 10000) / 100}%`;
  }

  if (cardType === "duration") {
    // incidents and impact-report downtime share one timeline so an incident
    // plus a report describing the same outage counts once; legacy reports
    // stay ignored to preserve pre-impact uptime values
    const intervals = events.flatMap((e) => {
      if (e.type === "incident") return clampedInterval(e.from, e.to, 1) ?? [];
      if (e.type === "report") return reportImpactIntervals(e);
      return [];
    });

    const total = data.length * MILLISECONDS_PER_DAY;
    if (total === 0) return "100%";
    const duration = mergedDowntimeMs(intervals);

    return `${Math.floor(((total - duration) / total) * 10000) / 100}%`;
  }

  const { ok, total } = data.reduce(
    (acc, item) => ({
      ok: acc.ok + item.ok + item.degraded,
      total: acc.total + item.ok + item.degraded + item.error,
    }),
    {
      ok: 0,
      total: 0,
    },
  );

  if (total === 0) return "100%";
  return `${Math.floor((ok / total) * 10000) / 100}%`;
}
