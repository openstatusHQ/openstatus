import { TZDate } from "@date-fns/tz";
import type { RouterOutputs } from "@openstatus/api";
import { format } from "date-fns";

// wire types inferred from the endpoint so server shape changes surface here
type HistoryWire = RouterOutputs["page"]["getUptimeHistory"];
type HistoryWireRow = HistoryWire["rows"][number];
export type HistoryUnit = HistoryWireRow["unit"] | "runs";
export type HistoryRow = Omit<HistoryWireRow, "unit" | "runs"> & {
  unit: HistoryUnit;
};
export type HistoryEvent = HistoryRow["events"][number];
export type HistoryMaintenanceWindow = HistoryRow["maintenanceWindows"][number];
export type HistoryExcusedOutage = HistoryRow["excusedOutages"][number];
export type HistoryValue = NonNullable<HistoryRow["months"][string]>;

export const HISTORY_METRICS = ["requests", "runs"] as const;
export type HistoryMetric = (typeof HISTORY_METRICS)[number];

/** The URL's metric, else runs on a runs page and requests otherwise. */
export function historyMetric(
  param: HistoryMetric | null,
  mode: HistoryWire["mode"],
): HistoryMetric {
  return param ?? (mode === "runs" ? "runs" : "requests");
}

/** Rows as `metric` counts them; rows without runs keep their own unit. */
export function historyRows(
  rows: HistoryWireRow[],
  metric: HistoryMetric,
): HistoryRow[] {
  return rows.map(({ runs, ...row }) =>
    metric === "runs" && runs ? { ...row, unit: "runs", ...runs } : row,
  );
}

/**
 * Events overlapping the month in the page time zone, which is how the server
 * buckets months; open-ended events count up to now.
 */
export function eventsForMonth<T extends Pick<HistoryEvent, "from" | "to">>(
  events: T[],
  key: string,
  timeZone = "UTC",
): T[] {
  const [year, month] = key.split("-").map(Number);
  const start = new TZDate(year, month - 1, 1, timeZone).getTime();
  const end = new TZDate(year, month, 1, timeZone).getTime();
  const now = Date.now();
  return events.filter((e) => {
    const from = e.from.getTime();
    const to = e.to?.getTime() ?? now;
    return from < end && to >= start;
  });
}

function monthKeyToDate(key: string): Date {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

/** Full month + year, e.g. "October 2025". */
export function monthKeyToFullLabel(key: string): string {
  return format(monthKeyToDate(key), "MMMM yyyy");
}

/** The page's uptime for a month: the mean of the rows that have a value. */
export function pageMonthUptime(
  rows: Pick<HistoryRow, "months">[],
  key: string,
): number | null {
  const values = rows.flatMap((row) => {
    const value = row.months[key];
    return value ? [value.percentage] : [];
  });
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Minutes the month has run in `timeZone`; the current month counts up to `now`. */
export function monthMinutes(key: string, timeZone = "UTC", now = new Date()) {
  const [year, month] = key.split("-").map(Number);
  const start = new TZDate(year, month - 1, 1, timeZone).getTime();
  const end = Math.min(
    new TZDate(year, month, 1, timeZone).getTime(),
    now.getTime(),
  );
  return Math.max(0, (end - start) / 60_000);
}

/** Downtime as the share of the month the percentage leaves down. */
export function downtimeMinutes(
  percentage: number | null | undefined,
  key: string,
  timeZone = "UTC",
  now = new Date(),
): number | null {
  if (percentage === null || percentage === undefined) return null;
  return (monthMinutes(key, timeZone, now) * (100 - percentage)) / 100;
}

type Span = { from: Date; to: Date | null; components: string[] };

/** Everything the history lists: public events and dashboard-only annotations. */
export type HistoryItem = Span &
  (
    | { kind: "event"; event: HistoryEvent; monitorId: number | null }
    | { kind: "window"; window: HistoryMaintenanceWindow }
    | {
        kind: "excused";
        outage: HistoryExcusedOutage;
        monitorId: number | null;
      }
  );

export type HistoryItemKind = HistoryEvent["type"] | "window" | "excused";

export function historyItemKind(item: HistoryItem): HistoryItemKind {
  return item.kind === "event" ? item.event.type : item.kind;
}

export function historyItemKey(item: HistoryItem): string {
  if (item.kind === "event") return `${item.event.type}-${item.event.id}`;
  if (item.kind === "window") return `window-${item.window.id}`;
  return `excused-${item.outage.id}`;
}

/**
 * One item per event, window or excused outage, newest first. Rows share a
 * report or window when it covers several components, so items merge by id.
 */
export function historyItems(rows: HistoryRow[]): HistoryItem[] {
  const items = new Map<string, HistoryItem>();
  const add = (item: HistoryItem, component: string) => {
    const key = historyItemKey(item);
    const existing = items.get(key);
    if (existing) {
      if (!existing.components.includes(component)) {
        existing.components.push(component);
      }
    } else items.set(key, item);
  };
  for (const row of rows) {
    const { name, monitorId } = row.component;
    for (const event of row.events) {
      add(
        {
          kind: "event",
          event,
          monitorId,
          from: event.from,
          to: event.to,
          components: [name],
        },
        name,
      );
    }
    for (const window of row.maintenanceWindows) {
      add(
        {
          kind: "window",
          window,
          from: window.from,
          to: window.to,
          components: [name],
        },
        name,
      );
    }
    for (const outage of row.excusedOutages) {
      add(
        {
          kind: "excused",
          outage,
          monitorId,
          from: outage.from,
          to: outage.to,
          components: [name],
        },
        name,
      );
    }
  }
  return [...items.values()].sort(
    (a, b) => b.from.getTime() - a.from.getTime(),
  );
}
