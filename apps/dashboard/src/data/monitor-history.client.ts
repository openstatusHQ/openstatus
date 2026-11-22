import type { RouterOutputs } from "@openstatus/api";
import type { StatusCalendarMarker } from "@openstatus/ui/components/blocks/status-calendar";

import { formatNumber } from "@/lib/formatter";

import type { CheckCounts } from "./uptime-history.client";

type Report = RouterOutputs["monitorIncident"]["report"];
export type MonitorHistoryIncident = Report["incidents"][number];

export const HISTORY_SOURCES = ["outages", "requests", "runs"] as const;
export type HistorySource = (typeof HISTORY_SOURCES)[number];
export type CheckSource = Exclude<HistorySource, "outages">;

export const historySourceLabel: Record<HistorySource, string> = {
  outages: "Outages",
  requests: "Requests",
  runs: "Runs",
};

export type Checks = { ok: number; degraded: number; error: number };

export type HistoryMonth = {
  /** YYYY-MM, UTC */
  key: string;
  availability: number | null;
  downtimeMs: number;
  incidents: MonitorHistoryIncident[];
  requests: Checks | null;
  runs: Checks | null;
};

const DAY = 86_400_000;

export const checksTotal = (c: Checks) => c.ok + c.degraded + c.error;

/** Sums the days whose key starts with `prefix`; null without a single count. */
export function sumChecks(counts: CheckCounts[], prefix = ""): Checks | null {
  let ok = 0;
  let degraded = 0;
  let error = 0;
  for (const c of counts) {
    if (!c.day.startsWith(prefix)) continue;
    ok += c.ok;
    degraded += c.degraded;
    error += c.error;
  }
  return ok + degraded + error > 0 ? { ok, degraded, error } : null;
}

/** Percent that passed; degraded counts as up, like the uptime math. */
export function checkSuccess(c: Checks | null): number | null {
  return c ? ((c.ok + c.degraded) / checksTotal(c)) * 100 : null;
}

export function failedShare(c: Checks | null): number {
  return c ? c.error / checksTotal(c) : 0;
}

/** Report months joined with their outages and check counts, newest first. */
export function historyMonths(
  months: Report["months"],
  incidents: MonitorHistoryIncident[],
  requests: CheckCounts[],
  runs: CheckCounts[],
): HistoryMonth[] {
  const first = months[0]?.month.slice(0, 7) ?? "";
  // an outage carried in from before the window belongs to its first month
  const monthOf = (i: MonitorHistoryIncident) => {
    const key = new Date(i.startedAt).toISOString().slice(0, 7);
    return key < first ? first : key;
  };
  return months
    .map((m) => {
      const key = m.month.slice(0, 7);
      return {
        key,
        availability: m.availability,
        downtimeMs: m.downtimeMs,
        incidents: incidents.filter((i) => monthOf(i) === key),
        requests: sumChecks(requests, key),
        runs: sumChecks(runs, key),
      };
    })
    .toReversed();
}

/** A YYYY-MM-DD UTC day as the local-midnight Date StatusCalendar buckets by. */
export function calendarDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** UTC days a span touches; `start`/`end` bound each UTC day. */
export function utcDays(from: Date, to: Date) {
  const days: { key: string; date: Date; start: number; end: number }[] = [];
  let start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  while (start <= to.getTime()) {
    const key = new Date(start).toISOString().slice(0, 10);
    days.push({
      key,
      date: calendarDate(key),
      start,
      end: start + DAY,
    });
    start += DAY;
  }
  return days;
}

/** Each outage's UTC days, an ongoing one up to `now`. */
function outageDays(incidents: MonitorHistoryIncident[], now: Date) {
  return incidents.map((incident) => {
    const from = new Date(incident.startedAt);
    const to = incident.resolvedAt ? new Date(incident.resolvedAt) : now;
    return { incident, from, to, days: utcDays(from, to) };
  });
}

export function outageMarkers(
  incidents: MonitorHistoryIncident[],
  now: Date,
): StatusCalendarMarker[] {
  return outageDays(incidents, now).flatMap(({ incident: i, from, to, days }) =>
    days.map(({ key, date }) => ({
      id: `outage-${i.id}-${key}`,
      date,
      status: i.excusedAt ? ("empty" as const) : ("error" as const),
      type: "incident" as const,
      name: i.excusedAt ? "Excused outage" : "Outage",
      from,
      to: i.resolvedAt ? to : null,
      hatched: !!i.excusedAt,
    })),
  );
}

const CHECK_MARKER = "check-";

/** Days with failures: amber below 5% failed, red above. Tint only, see `isCheckMarker`. */
export function checkMarkers(
  counts: CheckCounts[],
  source: CheckSource,
): StatusCalendarMarker[] {
  return counts.flatMap((c) => {
    if (c.error === 0) return [];
    const total = checksTotal(c);
    return [
      {
        id: `${CHECK_MARKER}${source}-${c.day}`,
        date: calendarDate(c.day),
        status: c.error / total > 0.05 ? "error" : "degraded",
        type: "incident" as const,
        name: `${formatNumber(c.error)} of ${formatNumber(total)} ${source} failed`,
      },
    ];
  });
}

export const isCheckMarker = (marker: StatusCalendarMarker) =>
  String(marker.id).startsWith(CHECK_MARKER);

export type HistoryDay = {
  outage: { downtimeMs: number; count: number; excused: number } | null;
  requests: CheckCounts | null;
  runs: CheckCounts | null;
};

/** Everything the calendar's day card shows, keyed by UTC day. */
export function historyDays(
  incidents: MonitorHistoryIncident[],
  requests: CheckCounts[],
  runs: CheckCounts[],
  now: Date,
) {
  const outages = new Map<string, NonNullable<HistoryDay["outage"]>>();
  for (const { incident: i, from, to, days } of outageDays(incidents, now)) {
    for (const d of days) {
      const cur = outages.get(d.key) ?? { downtimeMs: 0, count: 0, excused: 0 };
      if (i.excusedAt) cur.excused++;
      else {
        cur.count++;
        cur.downtimeMs += Math.max(
          0,
          Math.min(to.getTime(), d.end) - Math.max(from.getTime(), d.start),
        );
      }
      outages.set(d.key, cur);
    }
  }
  const requestsByDay = new Map(requests.map((c) => [c.day, c]));
  const runsByDay = new Map(runs.map((c) => [c.day, c]));
  return (key: string): HistoryDay => ({
    outage: outages.get(key) ?? null,
    requests: requestsByDay.get(key) ?? null,
    runs: runsByDay.get(key) ?? null,
  });
}
