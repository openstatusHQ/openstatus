import type {
  Incident,
  Maintenance,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";

type StatusData = {
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
  for (let i = 0; i < 45; i++) {
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
}: {
  errorDays: number[];
  degradedDays: number[];
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
  return fillStatusDataFor45Days(data, "1");
}

type Event = {
  id: number;
  name: string;
  from: Date;
  to: Date | null;
  type: "maintenance" | "incident" | "report";
  status: "success" | "degraded" | "error" | "info";
};

export function getEvents({
  maintenances,
  incidents,
  reports,
  monitorId,
  pastDays = 45,
}: {
  maintenances: (Maintenance & {
    maintenancesToMonitors: { monitorId: number }[];
  })[];
  incidents: Incident[];
  reports: (StatusReport & {
    monitorsToStatusReports: { monitorId: number }[];
    statusReportUpdates: StatusReportUpdate[];
  })[];
  monitorId?: number;
  pastDays?: number;
}): Event[] {
  const events: Event[] = [];
  const pastThreshod = new Date();
  pastThreshod.setDate(pastThreshod.getDate() - pastDays);

  // Filter maintenances - if monitorId is provided, filter by monitor, otherwise include all
  maintenances
    .filter((maintenance) =>
      monitorId
        ? maintenance.maintenancesToMonitors.some(
            (m) => m.monitorId === monitorId,
          )
        : true,
    )
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

  // Filter incidents - if monitorId is provided, filter by monitor, otherwise include all
  incidents
    .filter((incident) => (monitorId ? incident.monitorId === monitorId : true))
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

  // Filter reports - if monitorId is provided, filter by monitor, otherwise include all
  reports
    .filter((report) =>
      monitorId
        ? report.monitorsToStatusReports.some((m) => m.monitorId === monitorId)
        : true,
    )
    .map((report) => {
      const updates = report.statusReportUpdates.sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      if (updates.length === 0) return;

      const firstUpdate = updates[0];
      const lastUpdate = updates[updates.length - 1];

      // NOTE: we don't check threshold here because we display all unresolved reports
      if (!firstUpdate?.date) return;

      // HACKY: LEGACY: we shouldn't have report.status anymore and instead use the update status for that.
      // Ideally, we could replace the status with "downtime", "degraded", "operational" to indicate the gravity of the issue
      if (report.status === "resolved") {
        events.push({
          id: report.id,
          name: report.title,
          from: firstUpdate?.date,
          to: lastUpdate?.date,
          type: "report",
          status: "success" as const,
        });
        return;
      }

      events.push({
        id: report.id,
        name: report.title,
        from: firstUpdate?.date,
        to:
          lastUpdate?.status === "resolved" ||
          lastUpdate?.status === "monitoring"
            ? lastUpdate?.date
            : null,
        type: "report",
        status: "degraded" as const,
      });
    });

  return events;
}

// Keep the old function name for backward compatibility
export const getEventsByMonitorId = getEvents;

export function getWorstVariant(
  statuses: (keyof typeof STATUS_PRIORITY)[],
): keyof typeof STATUS_PRIORITY {
  if (statuses.length === 0) return "success";

  return statuses.reduce(
    (worst, current) => {
      return STATUS_PRIORITY[current] > STATUS_PRIORITY[worst]
        ? current
        : worst;
    },
    "success" as keyof typeof STATUS_PRIORITY,
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
    const eventTypes = [
      { status: "info" as const, events: maintenances },
      { status: "degraded" as const, events: reports },
      { status: "error" as const, events: incidents },
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
    const totalDuration = segments.reduce(
      (sum, segment) => sum + segment.count,
      0,
    );

    return segments.map((segment) => ({
      status: segment.status,
      // NOTE: if totalDuration is 0 (single event without duration), we want to show 100% for the segment
      height: totalDuration > 0 ? (segment.count / totalDuration) * 100 : 100,
    }));
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
      // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
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
    const hasReports = reports.length > 0;
    const hasMaintenances = maintenances.length > 0;

    const eventStatus = hasIncidents
      ? "error"
      : hasReports
        ? "degraded"
        : hasMaintenances
          ? "info"
          : undefined;

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
        const manualEventStatus = hasReports
          ? "degraded"
          : hasMaintenances
            ? "info"
            : undefined;
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

      case "manual":
        const manualEventStatus = hasReports
          ? "degraded"
          : hasMaintenances
            ? "info"
            : undefined;
        cardData = [
          {
            status: manualEventStatus || "success",
            value: "",
          },
        ];
        break;
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
  if (barType === "manual") {
    const duration = events
      // NOTE: we want only user events
      .filter((e) => e.type === "report")
      .reduce((acc, item) => {
        if (!item.from) return acc;
        return acc + ((item.to || new Date()).getTime() - item.from.getTime());
      }, 0);

    const total = data.length * MILLISECONDS_PER_DAY;

    return `${Math.round(((total - duration) / total) * 10000) / 100}%`;
  }

  if (cardType === "duration") {
    const duration = events
      .filter((e) => e.type === "incident")
      .reduce((acc, item) => {
        if (!item.from) return acc;
        return acc + ((item.to || new Date()).getTime() - item.from.getTime());
      }, 0);

    const total = data.length * MILLISECONDS_PER_DAY;
    return `${Math.round(((total - duration) / total) * 10000) / 100}%`;
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
  return `${Math.round((ok / total) * 10000) / 100}%`;
}
