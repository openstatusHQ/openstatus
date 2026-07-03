import type { PageComponentImpact } from "@openstatus/db/src/schema";
import { impactToStatusType, worstImpact } from "@openstatus/db/src/schema";
import {
  type Event,
  MS_PER_DAY,
  type StatusData,
  type UptimeWindow,
  dayCoverage,
  durationDowntimeMs,
  floorPct,
  getHighestPriorityStatus,
  getWorstVariant,
  isDateWithinEvent,
  reportEventDayImpact,
  reportEventDayStatus,
  reportsOnlyDowntimeMs,
  requestsTally,
} from "@openstatus/services/status-timeline";

export * from "@openstatus/services/status-timeline";

// Status pages must render even when Tinybird is degraded. Read latency above
// this budget is treated as an outage and the page falls back to manual mode.
export const TINYBIRD_FALLBACK_TIMEOUT_MS = 5_000;

// Discriminated result of a guarded Tinybird read: `ok: true` carries the data,
// `ok: false` (timeout or error) carries `null` and signals manual-mode fallback.
export type TinybirdResult<T> =
  | { ok: true; data: T }
  | { ok: false; data: null };

// Races a Tinybird read against the fallback budget. `ok: false` (timeout or
// thrown error) signals the caller to serve manual mode — DB-authored events
// only — instead of hanging or 500ing on Tinybird.
export async function withTinybirdFallback<T>(
  fetch: () => Promise<T>,
  timeoutMs = TINYBIRD_FALLBACK_TIMEOUT_MS,
): Promise<TinybirdResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const data = await Promise.race([
      fetch(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("tinybird timeout")),
          timeoutMs,
        );
      }),
    ]);
    return { ok: true, data };
  } catch (err) {
    console.error("[status-page] tinybird unhealthy, using manual mode:", err);
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }
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

const MILLISECONDS_PER_MINUTE = 1000 * 60;

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
  return Math.min(total, MS_PER_DAY);
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
        height: ((MS_PER_DAY - errorSegmentCount) / MS_PER_DAY) * 100,
      },
      {
        status: "error" as const,
        height: (errorSegmentCount / MS_PER_DAY) * 100,
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
    const errorHeight = (Math.min(errorMs, MS_PER_DAY) / MS_PER_DAY) * 100;
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
        // row dot follows the day's worst impact; floors at degraded so an
        // operational-only slice never renders a green row (mirrors calendar)
        ...reports.map((e) => ({
          ...e,
          status:
            reportEventDayStatus(e, date) === "error"
              ? ("error" as const)
              : ("degraded" as const),
        })),
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
  if (barType === "manual" || cardType === "duration") {
    // Clamp event durations to the data lookback window to avoid
    // events outside the window producing negative uptime values.
    const timestamps = data.map((d) => new Date(d.day).getTime());
    const { segments: coverage, totalMs: total } = dayCoverage(timestamps);
    if (total === 0) return "100%";
    const windowEndDate = new Date(Math.max(...timestamps));
    windowEndDate.setUTCHours(23, 59, 59, 999);
    const window: UptimeWindow = {
      start: Math.min(...timestamps),
      end: windowEndDate.getTime(),
      now: Date.now(),
    };
    const duration =
      barType === "manual"
        ? reportsOnlyDowntimeMs(events, window, coverage)
        : durationDowntimeMs(events, window, coverage);
    return `${floorPct((total - duration) / total)}%`;
  }

  const { up, total } = requestsTally(data);
  if (total === 0) return "100%";
  return `${floorPct(up / total)}%`;
}
