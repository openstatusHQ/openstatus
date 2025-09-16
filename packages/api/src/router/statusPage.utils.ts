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

export function fillStatusDataFor45DaysNoop(): Array<StatusData> {
  const data: StatusData[] = Array.from({ length: 45 }, (_, i) => ({
    day: new Date(new Date().setDate(new Date().getDate() - i)).toISOString(),
    count: 1,
    ok: [4, 40].includes(i) ? 0 : 1,
    degraded: i === 40 ? 1 : 0,
    error: i === 4 ? 1 : 0,
    monitorId: "1",
  }));
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
        name: incident.title,
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
      const firstUpdate = updates[0];
      const lastUpdate = updates[updates.length - 1];
      if (!firstUpdate?.date || firstUpdate.date < pastThreshod) return;
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

  // Cap at 24 hours (86400000 milliseconds) per day
  return Math.min(total, 24 * 60 * 60 * 1000);
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
          // If there's an event override, show single status
          barData = [
            {
              status: eventStatus,
              height: 100,
            },
          ];
        } else if (total === 0) {
          // Empty day
          barData = [
            {
              status: "empty",
              height: 100,
            },
          ];
        } else {
          // Multiple segments for absolute view
          const segments = [
            { status: "success" as const, count: dayData.ok },
            { status: "degraded" as const, count: dayData.degraded },
            { status: "error" as const, count: dayData.error },
          ]
            .filter((segment) => segment.count > 0)
            .map((segment) => ({
              status: segment.status,
              height: (segment.count / total) * 100,
            }));

          barData = segments;
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
          cardData = [{ status: eventStatus ?? "empty", value: "" }];
        } else {
          const entries = [
            { status: "success" as const, count: dayData.ok },
            { status: "degraded" as const, count: dayData.degraded },
            { status: "error" as const, count: dayData.error },
            { status: "info" as const, count: 0 },
          ];

          cardData = entries
            .filter((entry) => entry.count > 0)
            .map((entry) => ({
              status: entry.status,
              value: `${formatNumber(entry.count)} reqs`,
            }));
        }
        break;

      case "duration":
        if (total === 0) {
          cardData = [{ status: eventStatus ?? "empty", value: "" }];
        } else {
          const entries = [
            { status: "error" as const, count: dayData.error },
            { status: "degraded" as const, count: dayData.degraded },
            { status: "success" as const, count: dayData.ok },
            { status: "info" as const, count: 0 },
          ];

          const map = new Map<
            "error" | "degraded" | "success" | "info",
            number
          >();

          cardData = entries
            .map((entry) => {
              if (entry.status === "error") {
                const totalDuration = getTotalEventsDurationMs(incidents, date);
                const minutes = Math.round(totalDuration / (1000 * 60));
                map.set("error", minutes);
                if (minutes === 0) return null;
                return {
                  status: entry.status,
                  value: formatDuration(minutes),
                };
              }

              if (entry.status === "degraded") {
                const totalDuration = getTotalEventsDurationMs(reports, date);
                const minutes = Math.round(totalDuration / (1000 * 60));
                map.set("degraded", minutes);
                if (minutes === 0) return null;
                return {
                  status: entry.status,
                  value: formatDuration(minutes),
                };
              }

              if (entry.status === "info") {
                const totalDuration = getTotalEventsDurationMs(
                  maintenances,
                  date,
                );
                const minutes = Math.round(totalDuration / (1000 * 60));
                map.set("info", minutes);
                if (minutes === 0) return null;
                return {
                  status: entry.status,
                  value: formatDuration(minutes),
                };
              }

              if (entry.status === "success") {
                let total = 0;
                // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
                map.forEach((d) => (total += d));

                const now = new Date();
                const startOfDay = new Date(date);
                startOfDay.setUTCHours(0, 0, 0, 0);

                let totalMinutesInDay: number;
                if (isToday(date)) {
                  const minutesElapsed = Math.floor(
                    (now.getTime() - startOfDay.getTime()) / (1000 * 60),
                  );
                  totalMinutesInDay = minutesElapsed;
                } else {
                  totalMinutesInDay = 24 * 60;
                }

                const minutes = Math.max(totalMinutesInDay - total, 0);
                if (minutes === 0) return null;
                return {
                  status: entry.status,
                  value: formatDuration(minutes),
                };
              }
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
          cardData = [{ status: eventStatus ?? "empty", value: "" }];
        } else {
          const entries = [
            { status: "error" as const, count: dayData.error },
            { status: "degraded" as const, count: dayData.degraded },
            { status: "success" as const, count: dayData.ok },
          ];

          cardData = entries
            .filter((entry) => entry.count > 0)
            .map((entry) => ({
              status: entry.status,
              value: `${formatNumber(entry.count)} reqs`,
            }));
        }
        break;
    }

    return {
      day: dayData.day,
      events: [...reports, ...maintenances],
      bar: barData,
      card: cardData,
    };
  });
}

export function getUptime({
  data,
  events,
  barType,
}: {
  data: StatusData[];
  events: Event[];
  barType: "absolute" | "dominant" | "manual";
}): string {
  if (barType === "manual") {
    const duration = events
      // NOTE: we want only user events
      .filter((e) => e.type === "report")
      .reduce((acc, item) => {
        if (!item.from) return acc;
        return acc + ((item.to || new Date()).getTime() - item.from.getTime());
      }, 0);

    const total = data.length * 24 * 60 * 60 * 1000;

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
